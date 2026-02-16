/**
 * Parses HTML clipboard content for a <table> element.
 * Returns array of { cells: [{ text, imgSrc }] } per row, or null if no table.
 */
export function parseHtmlTable(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const table = doc.querySelector('table')
  if (!table) return null

  const tbody = table.querySelector('tbody') || table
  const trs = [...tbody.querySelectorAll('tr')]
  if (trs.length === 0) return null

  // Skip header row if all cells are <th> and there are data rows after it
  const firstCells = [...trs[0].querySelectorAll('td, th')]
  const isHeader = trs.length > 1 && firstCells.length > 0 &&
    firstCells.every(c => c.tagName === 'TH')
  const dataRows = isHeader ? trs.slice(1) : trs

  return dataRows.map(tr => ({
    cells: [...tr.querySelectorAll('td, th')].map(td => {
      const img = td.querySelector('img')
      return {
        text: td.textContent.trim(),
        imgSrc: img?.src || null,
      }
    })
  }))
}

/**
 * Maps parsed table rows to grid row objects using column-count rules:
 *  - 3+ cols: col0=screenshot, col1=talkTrack, col2=clickPath
 *  - 2 cols with images: imgCol=screenshot, otherCol=talkTrack
 *  - 2 cols no images: col0=talkTrack, col1=clickPath
 *  - 1 col: talkTrack only
 */
export function mapTableToRows(parsedRows) {
  const colCount = parsedRows[0]?.cells.length || 0

  if (colCount >= 3) {
    return parsedRows.map(r => ({
      screenshot: r.cells[0].imgSrc || '',
      talkTrack: r.cells[1].text,
      clickPath: r.cells[2].text,
    }))
  }

  if (colCount === 2) {
    const col0HasImg = parsedRows.some(r => r.cells[0].imgSrc)
    const col1HasImg = parsedRows.some(r => r.cells[1].imgSrc)

    if (col0HasImg || col1HasImg) {
      const imgCol = col0HasImg ? 0 : 1
      const textCol = imgCol === 0 ? 1 : 0
      return parsedRows.map(r => ({
        screenshot: r.cells[imgCol].imgSrc || '',
        talkTrack: r.cells[textCol].text,
        clickPath: '',
      }))
    }

    return parsedRows.map(r => ({
      screenshot: '',
      talkTrack: r.cells[0].text,
      clickPath: r.cells[1].text,
    }))
  }

  return parsedRows.map(r => ({
    screenshot: '',
    talkTrack: r.cells[0]?.text || '',
    clickPath: '',
  }))
}

/**
 * Resolves an image src (data URI, https URL, blob URL) to base64.
 * Returns '' on failure.
 */
export async function resolveImageSrc(src) {
  if (!src) return ''
  if (src.startsWith('data:')) return src

  try {
    const resp = await fetch(src)
    const blob = await resp.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => resolve('')
      reader.readAsDataURL(blob)
    })
  } catch {
    return ''
  }
}
