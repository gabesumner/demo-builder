const BASE_URL = 'https://www.googleapis.com/drive/v3/files'
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files'
const FOLDER_NAME = 'Demo Builder Projects'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

async function driveRequest(url, token, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg = body.error?.message || `Drive API error ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    throw err
  }
  if (res.status === 204) return null
  return res.json()
}

// --- Folder ---

let cachedFolderId = null

export async function ensureAppFolder(token) {
  if (cachedFolderId) return cachedFolderId

  // Search for existing folder
  const q = `name='${FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and 'root' in parents and trashed=false`
  const result = await driveRequest(
    `${BASE_URL}?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`,
    token,
  )

  if (result.files?.length > 0) {
    cachedFolderId = result.files[0].id
    return cachedFolderId
  }

  // Create folder
  const folder = await driveRequest(BASE_URL, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: FOLDER_MIME,
    }),
  })

  cachedFolderId = folder.id
  return cachedFolderId
}

export function clearFolderCache() {
  cachedFolderId = null
}

// --- List files ---

export async function listDemoFiles(token, folderId) {
  const q = `'${folderId}' in parents and trashed=false and name contains '.agentforce.json'`
  const fields = 'files(id,name,modifiedTime,appProperties)'
  const result = await driveRequest(
    `${BASE_URL}?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&pageSize=100&orderBy=modifiedTime desc`,
    token,
  )
  return result.files || []
}

// --- Read file ---

export async function readFile(token, fileId) {
  const res = await fetch(`${BASE_URL}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const err = new Error(`Failed to read file: ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

// --- Metadata (for polling) ---

export async function getFileMetadata(token, fileId) {
  return driveRequest(
    `${BASE_URL}/${fileId}?fields=id,modifiedTime,name,trashed`,
    token,
  )
}

// --- Create file (multipart upload) ---

export async function createFile(token, folderId, fileName, demoData, appProps = {}) {
  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: 'application/json',
    appProperties: appProps,
  }

  const boundary = '---demo_builder_boundary'
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    JSON.stringify(demoData),
    `--${boundary}--`,
  ].join('\r\n')

  return driveRequest(`${UPLOAD_URL}?uploadType=multipart&fields=id,modifiedTime`, token, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
}

// --- Update file content ---

export async function updateFile(token, fileId, demoData) {
  return driveRequest(`${UPLOAD_URL}/${fileId}?uploadType=media&fields=id,modifiedTime`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(demoData),
  })
}

// --- Trash file ---

export async function trashFile(token, fileId) {
  return driveRequest(`${BASE_URL}/${fileId}`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  })
}

// --- Rename file ---

export async function renameFile(token, fileId, newName) {
  return driveRequest(`${BASE_URL}/${fileId}?fields=id,name`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName }),
  })
}
