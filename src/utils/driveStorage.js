import {
  ensureAppFolder,
  listDemoFiles,
  readFile,
  getFileMetadata,
  createFile,
  updateFile,
  trashFile,
  clearFolderCache,
} from './driveApi'
import { createEmptyDemo } from './storage'

function makeFileName(name) {
  return `${name}.agentforce.json`
}

// --- List demos from Drive ---

export async function getDriveList(token) {
  const folderId = await ensureAppFolder(token)
  const files = await listDemoFiles(token, folderId)

  return files.map(file => {
    const demoId = file.appProperties?.demoId || file.id
    const demoName = file.appProperties?.demoName || file.name.replace(/\.agentforce\.json$/, '')
    return {
      id: demoId,
      name: demoName,
      lastModified: new Date(file.modifiedTime).getTime(),
      storage: 'drive',
      driveFileId: file.id,
      driveModifiedTime: file.modifiedTime,
    }
  })
}

// --- Read demo data from Drive ---

export async function getDriveDemoData(token, driveFileId) {
  const content = await readFile(token, driveFileId)
  // File format: { version, demoId, name, data }
  return content.data || content
}

// --- Save demo data to Drive ---

export async function saveDriveDemoData(token, driveFileId, data) {
  const fileContent = {
    version: 1,
    data,
  }
  const result = await updateFile(token, driveFileId, fileContent)
  return { modifiedTime: result.modifiedTime }
}

// --- Create a new demo in Drive ---

export async function createDriveDemo(token, name) {
  const demoId = crypto.randomUUID()
  const folderId = await ensureAppFolder(token)
  const emptyData = createEmptyDemo()
  const fileContent = {
    version: 1,
    demoId,
    name,
    data: emptyData,
  }
  const appProps = { demoId, demoName: name, version: '1' }
  const result = await createFile(token, folderId, makeFileName(name), fileContent, appProps)

  return {
    id: demoId,
    driveFileId: result.id,
    driveModifiedTime: result.modifiedTime,
  }
}

// --- Delete a demo from Drive ---

export async function deleteDriveDemo(token, driveFileId) {
  await trashFile(token, driveFileId)
}

// --- Upload existing local demo data to Drive ---

export async function uploadToDrive(token, name, data) {
  const demoId = crypto.randomUUID()
  const folderId = await ensureAppFolder(token)
  const fileContent = {
    version: 1,
    demoId,
    name,
    data,
  }
  const appProps = { demoId, demoName: name, version: '1' }
  const result = await createFile(token, folderId, makeFileName(name), fileContent, appProps)

  return {
    driveFileId: result.id,
    driveModifiedTime: result.modifiedTime,
  }
}

// --- Check if a file was modified externally (for polling) ---

export async function checkDriveModified(token, driveFileId, sinceTimestamp) {
  const meta = await getFileMetadata(token, driveFileId)
  if (meta.trashed) {
    return { modified: false, trashed: true }
  }
  const remoteTime = new Date(meta.modifiedTime).getTime()
  const modified = remoteTime > sinceTimestamp
  return { modified, modifiedTime: meta.modifiedTime }
}

// --- Import a Drive file (from Picker) ---

export async function importDriveFile(token, fileId) {
  const content = await readFile(token, fileId)
  const meta = await getFileMetadata(token, fileId)
  const data = content.data || content
  const name = content.name || meta.name.replace(/\.agentforce\.json$/, '')
  const demoId = content.demoId || crypto.randomUUID()

  return {
    id: demoId,
    name,
    driveFileId: fileId,
    driveModifiedTime: meta.modifiedTime,
    data,
  }
}

export { clearFolderCache }
