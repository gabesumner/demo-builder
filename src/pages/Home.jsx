import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDemoList, getDemoData, createDemo, deleteDemo, importDemos, mergeDriveEntries, updateDemoStorage, removeLocalData, getThumbnailCache, saveDemoList, saveDemoData } from '../utils/storage'
import { getDriveList, createDriveDemo, deleteDriveDemo, uploadToDrive, getDriveDemoData, importDriveFile } from '../utils/driveStorage'
import { getDemoListFromApi, getDemoDataFromApi, createDemoInApi, deleteDemoFromApi, saveDemoDataToApi, setThumbnailCache } from '../utils/apiStorage'
import { useGoogleAuth } from '../contexts/GoogleAuthContext'
import { useStorageMode } from '../contexts/StorageModeContext'
import { GRADIENT_PRESETS } from '../steps/Overview'
import NewDemoModal from '../components/NewDemoModal'
import MoveConfirmModal from '../components/MoveConfirmModal'

const CANVAS_W = 600
const CANVAS_H = CANVAS_W * 9 / 16

function getGradient(gradientId) {
  const preset = GRADIENT_PRESETS.find(g => g.id === gradientId)
  return preset ? preset.gradient : GRADIENT_PRESETS[1].gradient
}

function getHeadlineFontSize(text) {
  const len = (text || '').length
  if (len <= 75) return '2.15rem'
  return '1.75rem'
}

function ThumbnailPreview({ overview }) {
  const containerRef = useRef(null)
  const [scale, setScale] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      setScale(entries[0].contentRect.width / CANVAS_W)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { headline = '', thumbnailImage = '', gradientId = 'sf-brand', imageOffset = { x: 50, y: 50 } } = overview || {}

  return (
    <div ref={containerRef} className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-transparent group-hover:border-sf-blue-light/50 transition-all shadow-lg group-hover:shadow-sf-blue/20">
      <div
        className="thumb-canvas"
        style={{
          width: `${CANVAS_W}px`,
          height: `${CANVAS_H}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'absolute',
          top: 0,
          left: 0,
          background: getGradient(gradientId),
          pointerEvents: 'none',
        }}
      >
        {headline && (
          <div className="thumb-headline-area">
            <div
              className="thumb-headline-text"
              style={{ fontSize: getHeadlineFontSize(headline), cursor: 'default' }}
            >
              {headline}
            </div>
          </div>
        )}

        {thumbnailImage && (
          <div className="thumb-image-area" style={{ cursor: 'default' }}>
            <div className="thumb-image-container" style={{ cursor: 'default' }}>
              <img
                src={thumbnailImage}
                alt=""
                className="thumb-image"
                draggable={false}
                style={{ objectPosition: `${imageOffset.x}% ${imageOffset.y}%` }}
              />
            </div>
          </div>
        )}

        {!headline && !thumbnailImage && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white/30 text-sm">No content yet</span>
          </div>
        )}
      </div>
    </div>
  )
}

function StorageBadge({ storage }) {
  if (storage === 'drive') {
    return (
      <span className="flex items-center gap-1 text-[10px] text-slate-600" title="Stored in Google Drive">
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7.71 3.5L1.15 15l3.43 5.5h6.52l-3.43-5.5 3.43-5.5L7.71 3.5zm1.73 0l6.57 11.5H22.58L16.02 3.5H9.44zm6.86 12L13.16 20.5h6.56l3.14-5H16.3z" />
        </svg>
        Drive
      </span>
    )
  }
  return null
}

// --- Google Picker ---

let pickerApiLoaded = false

function loadPickerApi() {
  return new Promise((resolve, reject) => {
    if (pickerApiLoaded) { resolve(); return }
    const script = document.createElement('script')
    script.src = 'https://apis.google.com/js/api.js'
    script.onload = () => {
      window.gapi.load('picker', () => {
        pickerApiLoaded = true
        resolve()
      })
    }
    script.onerror = reject
    document.head.appendChild(script)
  })
}

function openPicker(accessToken, apiKey) {
  return new Promise((resolve) => {
    const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
    view.setQuery('*.agentforce.json')
    view.setIncludeFolders(true)

    const picker = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .setTitle('Open Demo from Google Drive')
      .setCallback((data) => {
        if (data.action === window.google.picker.Action.PICKED) {
          resolve(data.docs[0])
        } else if (data.action === window.google.picker.Action.CANCEL) {
          resolve(null)
        }
      })
      .build()
    picker.setVisible(true)
  })
}

// --- Main Component ---

export default function Home() {
  const { mode: storageMode, loading: storageModeLoading } = useStorageMode()
  const isPostgres = storageMode === 'postgres'

  const [demos, setDemos] = useState(() => isPostgres ? [] : getDemoList())
  const [showConfirm, setShowConfirm] = useState(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [moveTarget, setMoveTarget] = useState(null) // { id, name, storage, driveFileId }
  const [isMoving, setIsMoving] = useState(false)
  const [driveLoading, setDriveLoading] = useState(false)
  const [pgLoading, setPgLoading] = useState(false)
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const { isSignedIn, isLoading: authLoading, user, signIn, signOut, ensureToken, hasClientId } = useGoogleAuth()

  // Refresh list — branches on storage mode
  const refreshList = useCallback(() => {
    if (isPostgres) {
      getDemoListFromApi().then(setDemos).catch(console.error)
    } else {
      setDemos(getDemoList())
    }
  }, [isPostgres])

  // Fetch Postgres demos on mount
  useEffect(() => {
    if (storageModeLoading || !isPostgres) return
    setPgLoading(true)
    getDemoListFromApi()
      .then(setDemos)
      .catch(console.error)
      .finally(() => setPgLoading(false))
  }, [isPostgres, storageModeLoading])

  useEffect(() => {
    if (!isSignedIn) return
    let cancelled = false
    async function fetchDrive() {
      setDriveLoading(true)
      try {
        const token = await ensureToken()
        const driveList = await getDriveList(token)
        if (!cancelled) {
          mergeDriveEntries(driveList)
          refreshList()
        }
      } catch (err) {
        console.error('Failed to fetch Drive demos:', err)
      } finally {
        if (!cancelled) setDriveLoading(false)
      }
    }
    fetchDrive()
    return () => { cancelled = true }
  }, [isSignedIn, ensureToken, refreshList])

  // --- Create demo ---
  async function handleCreate(name, storage) {
    if (isPostgres) {
      try {
        const result = await createDemoInApi(name)
        refreshList()
        navigate(`/demo/${result.id}`)
      } catch (err) {
        console.error('Failed to create demo:', err)
        alert('Failed to create demo.')
      }
      return
    }
    if (storage === 'drive') {
      try {
        const token = await ensureToken()
        const { id, driveFileId, driveModifiedTime } = await createDriveDemo(token, name)
        const list = getDemoList()
        list.push({ id, name, lastModified: Date.now(), storage: 'drive', driveFileId, driveModifiedTime })
        saveDemoList(list)
        refreshList()
        navigate(`/demo/${id}`)
      } catch (err) {
        console.error('Failed to create Drive demo:', err)
        alert('Failed to create demo on Google Drive. Creating locally instead.')
        const id = await createDemo(name, 'local')
        refreshList()
        navigate(`/demo/${id}`)
      }
    } else {
      const id = await createDemo(name, 'local')
      refreshList()
      navigate(`/demo/${id}`)
    }
  }

  // --- Delete ---
  async function handleDelete(e, demo) {
    e.stopPropagation()
    if (isPostgres) {
      await deleteDemoFromApi(demo.id)
      refreshList()
      setShowConfirm(null)
      return
    }
    if (demo.storage === 'drive' && demo.driveFileId) {
      try {
        const token = await ensureToken()
        await deleteDriveDemo(token, demo.driveFileId)
      } catch (err) {
        console.error('Failed to delete from Drive:', err)
      }
    }
    await deleteDemo(demo.id)
    refreshList()
    setShowConfirm(null)
  }

  // --- Export ---
  async function handleExport(e, demo) {
    e.stopPropagation()
    let data
    if (isPostgres) {
      const result = await getDemoDataFromApi(demo.id)
      data = result.data
    } else if (demo.storage === 'drive' && demo.driveFileId) {
      try {
        const token = await ensureToken()
        data = await getDriveDemoData(token, demo.driveFileId)
      } catch {
        data = await getDemoData(demo.id) // Fallback to cached
      }
    } else {
      data = await getDemoData(demo.id)
    }
    const exportData = { version: 1, demos: [{ id: demo.id, name: demo.name, lastModified: demo.lastModified, data }] }
    const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const slug = demo.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    a.download = `${slug}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // --- Import ---
  function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        if (isPostgres) {
          const parsed = JSON.parse(reader.result)
          if (!parsed || !Array.isArray(parsed.demos)) throw new Error('Invalid file format')
          for (const demo of parsed.demos) {
            const result = await createDemoInApi(demo.name)
            await saveDemoDataToApi(result.id, demo.data)
            if (demo.data?.overview) {
              setThumbnailCache(result.id, demo.data.overview)
            }
          }
        } else {
          await importDemos(reader.result)
        }
        refreshList()
      } catch {
        alert('Failed to import. The file may be invalid.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // --- Move demo ---
  async function handleMove() {
    if (!moveTarget) return
    setIsMoving(true)
    try {
      if (moveTarget.storage === 'local') {
        // Local -> Drive
        const token = await ensureToken()
        const data = await getDemoData(moveTarget.id)
        const { driveFileId, driveModifiedTime } = await uploadToDrive(token, moveTarget.name, data)
        updateDemoStorage(moveTarget.id, { storage: 'drive', driveFileId, driveModifiedTime })
        await removeLocalData(moveTarget.id)
      } else {
        // Drive -> Local
        const token = await ensureToken()
        const data = await getDriveDemoData(token, moveTarget.driveFileId)
        await saveDemoData(moveTarget.id, data)
        await deleteDriveDemo(token, moveTarget.driveFileId)
        updateDemoStorage(moveTarget.id, { storage: 'local', driveFileId: null, driveModifiedTime: null })
      }
      refreshList()
    } catch (err) {
      console.error('Move failed:', err)
      alert('Failed to move demo. Please try again.')
    } finally {
      setIsMoving(false)
      setMoveTarget(null)
    }
  }

  // --- Open from Drive (Picker) ---
  async function handleOpenFromDrive() {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY
    if (!apiKey) {
      alert('Google API Key not configured. Add VITE_GOOGLE_API_KEY to your .env file.')
      return
    }
    try {
      const token = await ensureToken()
      await loadPickerApi()
      const doc = await openPicker(token, apiKey)
      if (!doc) return
      const imported = await importDriveFile(token, doc.id)
      // Add to demo list
      const list = getDemoList()
      if (!list.find(d => d.driveFileId === doc.id)) {
        list.push({
          id: imported.id,
          name: imported.name,
          lastModified: Date.now(),
          storage: 'drive',
          driveFileId: imported.driveFileId,
          driveModifiedTime: imported.driveModifiedTime,
        })
        saveDemoList(list)
      }
      refreshList()
      navigate(`/demo/${imported.id}`)
    } catch (err) {
      console.error('Open from Drive failed:', err)
    }
  }

  // --- Render ---

  function getOverview(demo) {
    return getThumbnailCache(demo.id) || {}
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold text-white">Demo Builder</h1>
            <p className="text-slate-500 mt-1">Create and manage your product projects</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Auth controls — hidden in postgres mode */}
            {!isPostgres && hasClientId && (
              isSignedIn ? (
                <div className="flex items-center gap-2 mr-2">
                  <span className="text-xs text-slate-500 truncate max-w-32">{user?.email}</span>
                  <button
                    onClick={signOut}
                    className="text-slate-600 hover:text-slate-400 text-xs cursor-pointer bg-transparent border-none transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <button
                  onClick={signIn}
                  disabled={authLoading}
                  className="text-slate-400 hover:text-white bg-transparent hover:bg-white/5 border border-dark-border px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  title="Sign in to sync with Google Drive"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.71 3.5L1.15 15l3.43 5.5h6.52l-3.43-5.5 3.43-5.5L7.71 3.5zm1.73 0l6.57 11.5H22.58L16.02 3.5H9.44zm6.86 12L13.16 20.5h6.56l3.14-5H16.3z" />
                  </svg>
                  Sign in
                </button>
              )
            )}

            {/* Open from Drive — hidden in postgres mode */}
            {!isPostgres && isSignedIn && (
              <button
                onClick={handleOpenFromDrive}
                className="text-slate-400 hover:text-white bg-transparent hover:bg-white/5 border border-dark-border px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                title="Open demo from Google Drive"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                </svg>
                Open
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-slate-400 hover:text-white bg-transparent hover:bg-white/5 border border-dark-border px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-8-8l-4 4m0 0l4 4m-4-4h12" />
              </svg>
              Import
            </button>
            <button
              onClick={() => setShowNewModal(true)}
              className="bg-sf-blue hover:bg-sf-blue-light text-white px-5 py-2.5 rounded-lg font-medium transition-colors cursor-pointer border-none"
            >
              + New Demo
            </button>
          </div>
        </div>

        {pgLoading && (
          <div className="text-center text-slate-600 text-xs mb-4 flex items-center justify-center gap-2">
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading demos...
          </div>
        )}

        {driveLoading && (
          <div className="text-center text-slate-600 text-xs mb-4 flex items-center justify-center gap-2">
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading Drive demos...
          </div>
        )}

        {demos.length === 0 ? (
          <div className="text-center py-20 bg-dark-surface rounded-xl border border-dark-border">
            <div className="text-5xl mb-4 opacity-60">🎬</div>
            <p className="text-slate-400 text-lg">No demos yet</p>
            <p className="text-slate-600 mt-1">Click "+ New Demo" to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {demos
              .sort((a, b) => b.lastModified - a.lastModified)
              .map(demo => {
                const overview = getOverview(demo)

                return (
                  <div
                    key={demo.id}
                    className="group cursor-pointer"
                    onClick={() => navigate(`/demo/${demo.id}`)}
                  >
                    <ThumbnailPreview overview={overview} />

                    <div className="flex items-center justify-between mt-2.5 px-1">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-300 truncate">{demo.name}</h3>
                        <StorageBadge storage={demo.storage} />
                      </div>
                      <div className="flex-shrink-0 ml-2">
                        {showConfirm === demo.id ? (
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={(e) => handleDelete(e, demo)}
                              className="text-red-400 hover:bg-red-400/10 px-2 py-0.5 rounded text-xs font-medium cursor-pointer bg-transparent border-none"
                            >
                              Delete
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowConfirm(null) }}
                              className="text-slate-500 hover:bg-white/5 px-2 py-0.5 rounded text-xs cursor-pointer bg-transparent border-none"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-0.5">
                            {/* Move button — hidden in postgres mode */}
                            {!isPostgres && isSignedIn && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setMoveTarget(demo) }}
                                className="text-slate-700 hover:text-slate-300 p-1 rounded transition-colors cursor-pointer bg-transparent border-none opacity-0 group-hover:opacity-100"
                                title={demo.storage === 'drive' ? 'Move to local storage' : 'Move to Google Drive'}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleExport(e, demo) }}
                              className="text-slate-700 hover:text-slate-300 p-1 rounded transition-colors cursor-pointer bg-transparent border-none opacity-0 group-hover:opacity-100"
                              title="Export demo"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowConfirm(demo.id) }}
                              className="text-slate-700 hover:text-red-400 p-1 rounded transition-colors cursor-pointer bg-transparent border-none opacity-0 group-hover:opacity-100"
                              title="Delete demo"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      <NewDemoModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreate={handleCreate}
        driveAvailable={isSignedIn}
        postgresMode={isPostgres}
      />

      <MoveConfirmModal
        isOpen={!!moveTarget}
        direction={moveTarget?.storage === 'local' ? 'to-drive' : 'to-local'}
        demoName={moveTarget?.name || ''}
        onConfirm={handleMove}
        onCancel={() => !isMoving && setMoveTarget(null)}
        isMoving={isMoving}
      />
    </div>
  )
}
