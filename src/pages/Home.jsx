import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDemoList, getDemoData, createDemo, deleteDemo, saveDemoData, importDemos, getThumbnailCache } from '../utils/storage'
import { getDemoListFromApi, getDemoDataFromApi, createDemoInApi, deleteDemoFromApi, saveDemoDataToApi, setThumbnailCache } from '../utils/apiStorage'
import { exportDemoAsZip, importFromZip } from '../utils/zipPorter'
import { useStorageMode } from '../contexts/StorageModeContext'
import { GRADIENT_PRESETS } from '../steps/Overview'
import NewDemoModal from '../components/NewDemoModal'

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

// --- Main Component ---

export default function Home() {
  const { mode: storageMode, loading: storageModeLoading } = useStorageMode()
  const isPostgres = storageMode === 'postgres'

  const [demos, setDemos] = useState(() => isPostgres ? [] : getDemoList())
  const [showConfirm, setShowConfirm] = useState(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [pgLoading, setPgLoading] = useState(false)
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const refreshList = useCallback(() => {
    if (isPostgres) {
      getDemoListFromApi()
        .then(list => {
          list.forEach(demo => {
            if (demo.overview) setThumbnailCache(demo.id, demo.overview)
          })
          setDemos(list)
        })
        .catch(console.error)
    } else {
      setDemos(getDemoList())
    }
  }, [isPostgres])

  useEffect(() => {
    if (storageModeLoading || !isPostgres) return
    setPgLoading(true)
    getDemoListFromApi()
      .then(list => {
        list.forEach(demo => {
          if (demo.overview) setThumbnailCache(demo.id, demo.overview)
        })
        setDemos(list)
      })
      .catch(console.error)
      .finally(() => setPgLoading(false))
  }, [isPostgres, storageModeLoading])

  // --- Create demo ---
  async function handleCreate(name) {
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
    const id = await createDemo(name, 'local')
    refreshList()
    navigate(`/demo/${id}`)
  }

  // --- Delete ---
  async function handleDelete(e, demo) {
    e.stopPropagation()
    if (isPostgres) {
      await deleteDemoFromApi(demo.id)
    } else {
      await deleteDemo(demo.id)
    }
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
    } else {
      data = await getDemoData(demo.id)
    }
    await exportDemoAsZip(demo, data, { isPostgres })
  }

  // --- Import ---
  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    try {
      if (file.name.endsWith('.zip')) {
        const { name, data } = await importFromZip(file, { isPostgres })
        if (isPostgres) {
          const result = await createDemoInApi(name)
          await saveDemoDataToApi(result.id, data)
          if (data?.overview) setThumbnailCache(result.id, data.overview)
        } else {
          const newId = await createDemo(name)
          await saveDemoData(newId, data)
          if (data?.overview) setThumbnailCache(newId, data.overview)
        }
      } else {
        // Legacy JSON import (backward compat)
        const text = await file.text()
        if (isPostgres) {
          const parsed = JSON.parse(text)
          if (!parsed || !Array.isArray(parsed.demos)) throw new Error('Invalid file format')
          for (const demo of parsed.demos) {
            const result = await createDemoInApi(demo.name)
            await saveDemoDataToApi(result.id, demo.data)
            if (demo.data?.overview) setThumbnailCache(result.id, demo.data.overview)
          }
        } else {
          await importDemos(text)
        }
      }
      refreshList()
    } catch {
      alert('Failed to import. The file may be invalid.')
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
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,.json"
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

        {!pgLoading && demos.length === 0 ? (
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
      />
    </div>
  )
}
