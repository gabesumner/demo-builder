import JSZip from 'jszip'
import { idbGetImage, idbSaveImage } from './idbStorage'

// Collect all out-of-band image IDs (img_...) referenced in demo data.
function collectImageIds(data) {
  const ids = new Set()
  for (const panel of data.storyboard || []) {
    if (panel.image?.startsWith('img_')) ids.add(panel.image)
  }
  for (const row of data.grid || []) {
    if (row.screenshot?.startsWith('img_')) ids.add(row.screenshot)
  }
  for (const side of ['from', 'to']) {
    if (data.fromTo?.[side]?.image?.startsWith('img_')) ids.add(data.fromTo[side].image)
  }
  return [...ids]
}

export async function exportDemoAsZip(demo, data, { isPostgres = false } = {}) {
  const zip = new JSZip()

  zip.file('demo.json', JSON.stringify({
    version: 2,
    id: demo.id,
    name: demo.name,
    lastModified: demo.lastModified,
    data,
  }, null, 2))

  const imageIds = collectImageIds(data)
  if (imageIds.length > 0) {
    const imagesFolder = zip.folder('images')
    await Promise.all(imageIds.map(async id => {
      let blob
      if (isPostgres) {
        const res = await fetch(`/images/${id}`)
        if (res.ok) blob = await res.blob()
      } else {
        blob = await idbGetImage(id)
      }
      if (blob) imagesFolder.file(`${id}.png`, blob)
    }))
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const slug = demo.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  a.download = `${slug}-${new Date().toISOString().slice(0, 10)}.zip`
  a.click()
  URL.revokeObjectURL(url)
}

// Returns { name, lastModified, data } for the demo contained in the ZIP.
export async function importFromZip(file, { isPostgres = false } = {}) {
  const zip = await JSZip.loadAsync(file)

  const jsonFile = zip.file('demo.json')
  if (!jsonFile) throw new Error('Invalid ZIP: missing demo.json')

  const payload = JSON.parse(await jsonFile.async('string'))
  if (!payload.data) throw new Error('Invalid ZIP: missing data field')

  // Restore images — IDB for local, server API for Postgres (preserving IDs so references stay valid)
  const imageFiles = []
  zip.folder('images')?.forEach((relativePath, zipEntry) => {
    if (!zipEntry.dir) imageFiles.push({ relativePath, zipEntry })
  })
  await Promise.all(imageFiles.map(async ({ relativePath, zipEntry }) => {
    const id = relativePath.replace(/\.png$/, '')
    const blob = await zipEntry.async('blob')
    if (isPostgres) {
      await fetch(`/api/images/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/png' },
        body: blob,
      })
    } else {
      await idbSaveImage(id, blob)
    }
  }))

  return {
    name: payload.name || 'Imported Demo',
    lastModified: payload.lastModified || Date.now(),
    data: payload.data,
  }
}
