import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getDemoData, getDemoList, updateDemoName, setThumbnailCache } from '../utils/storage'
import { getDriveDemoData } from '../utils/driveStorage'
import { useAutosave } from '../utils/useAutosave'
import { useGoogleAuth } from '../contexts/GoogleAuthContext'
import { useDrivePolling } from '../hooks/useDrivePolling'
import SaveStatusIndicator from '../components/SaveStatusIndicator'
import Overview from '../steps/Overview'
import Requirements from '../steps/Requirements'
import FromTo from '../steps/FromTo'
import Storyboard from '../steps/Storyboard'
import Outline from '../steps/Outline'
import Grid from '../steps/Grid'
import Watch from '../steps/Watch'

const STEPS = [
  { key: 'requirements', label: 'Requirements' },
  { key: 'overview', label: 'Takeaway' },
  { key: 'fromTo', label: 'From/To Shift' },
  { key: 'storyboard', label: 'Storyboard' },
  { key: 'outline', label: 'Outline' },
  { key: 'grid', label: 'Script' },
  { key: 'watch', label: 'Watch' },
]

const STEP_COMPONENTS = {
  overview: Overview,
  requirements: Requirements,
  fromTo: FromTo,
  storyboard: Storyboard,
  outline: Outline,
  grid: Grid,
  watch: Watch,
}

export default function DemoView() {
  const { demoId } = useParams()
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [transitionKey, setTransitionKey] = useState(0)
  const [transitionDir, setTransitionDir] = useState('right')
  const [saveStatus, setSaveStatus] = useState('idle')
  const isInitialMount = useRef(true)

  const { ensureToken, isSignedIn } = useGoogleAuth()

  // Look up demo metadata
  const demoMeta = useMemo(() => getDemoList().find(d => d.id === demoId), [demoId])
  const storage = demoMeta?.storage || 'local'
  const driveFileId = demoMeta?.driveFileId || null

  // Stable token getter for hooks
  const getToken = useCallback(() => ensureToken(), [ensureToken])

  // Save status callback
  const onSaveStatus = useCallback((status) => setSaveStatus(status), [])

  const save = useAutosave(demoId, {
    storage,
    driveFileId,
    getToken: storage === 'drive' ? getToken : null,
    onSaveStatus: storage === 'drive' ? onSaveStatus : null,
  })

  // --- Load demo data ---
  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setLoadError(null)
      try {
        if (storage === 'drive' && driveFileId) {
          const token = await ensureToken()
          const driveData = await getDriveDemoData(token, driveFileId)
          if (!cancelled) setData(driveData)
        } else {
          const localData = await getDemoData(demoId)
          if (!cancelled) setData(localData)
        }
      } catch (err) {
        console.error('Failed to load from Drive:', err)
        if (!cancelled) {
          // Try local shadow copy
          const shadow = await getDemoData(demoId)
          if (shadow && Object.keys(shadow).length > 0) {
            setData(shadow)
          } else {
            setLoadError(err)
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [demoId, storage, driveFileId, ensureToken])

  // --- Auto-save whenever data changes (skip initial load) ---
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    if (!data) return
    save(data)
    // Update thumbnail cache so Home page can render without loading full data
    if (data.overview) {
      setThumbnailCache(demoId, data.overview)
    }
  }, [data, save, demoId])

  // --- Polling for external changes (Drive only) ---
  const [lastModifiedTime, setLastModifiedTime] = useState(demoMeta?.driveModifiedTime)

  const handleExternalChange = useCallback((newData, newModifiedTime) => {
    setData(newData)
    setLastModifiedTime(newModifiedTime)
    isInitialMount.current = true // Prevent re-save of externally loaded data
    setTimeout(() => { isInitialMount.current = false }, 100)
  }, [])

  useDrivePolling(driveFileId, lastModifiedTime, {
    enabled: storage === 'drive' && isSignedIn && !isLoading,
    getToken,
    onExternalChange: handleExternalChange,
  })

  // --- UI state ---
  const [showTitles, setShowTitles] = useState(false)

  const [demoName, setDemoName] = useState(() => {
    const info = getDemoList().find(d => d.id === demoId)
    return info?.name || 'Untitled Demo'
  })

  function handleDemoNameChange(newName) {
    setDemoName(newName)
    updateDemoName(demoId, newName)
  }

  const updateData = useCallback((stepKey, stepData) => {
    setData(prev => ({ ...prev, [stepKey]: stepData }))
  }, [])

  function goToStep(newStep) {
    if (newStep === currentStep || newStep < 0 || newStep >= STEPS.length) return
    setTransitionDir(newStep > currentStep ? 'right' : 'left')
    setCurrentStep(newStep)
    setTransitionKey(prev => prev + 1)
  }

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e) {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.target.contentEditable === 'true') return

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goToStep(currentStep - 1)
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        goToStep(currentStep + 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentStep])

  // --- Loading / Error states ---
  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <svg className="w-8 h-8 animate-spin text-sf-blue mx-auto mb-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-slate-500 text-sm">
            {storage === 'drive' ? 'Loading from Google Drive...' : 'Loading...'}
          </p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-center max-w-md">
          <svg className="w-10 h-10 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-slate-300 font-medium mb-1">Failed to load demo</p>
          <p className="text-slate-500 text-sm mb-4">{loadError.message}</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 text-sm rounded-lg bg-transparent border border-dark-border text-slate-400 cursor-pointer hover:bg-white/5 transition-colors"
            >
              Go back
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm rounded-lg bg-sf-blue text-white border-none cursor-pointer hover:bg-sf-blue-light transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  const StepComponent = STEP_COMPONENTS[STEPS[currentStep].key]
  const stepKey = STEPS[currentStep].key

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col">
      {/* Subtle navigation — thin bar that reveals on hover */}
      <div className="group/nav sticky top-0 z-10">
        <div className="bg-dark-bg/80 backdrop-blur-md border-b border-white/[0.04] transition-all duration-300 group-hover/nav:border-white/[0.08]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="relative flex items-center h-10">
              {/* Left side: back + demo name + save status */}
              <div className="absolute left-0 flex items-center gap-2">
                <button
                  onClick={() => navigate('/')}
                  className="text-slate-600 hover:text-slate-400 transition-colors cursor-pointer bg-transparent border-none text-xs mr-1 flex-shrink-0"
                >
                  ←
                </button>
                <span className="text-xs text-slate-500 truncate max-w-40">
                  {demoName}
                </span>
                <SaveStatusIndicator status={saveStatus} storage={storage} />
              </div>

              {/* Step indicators — always centered */}
              <nav className="flex items-center gap-1 w-full justify-center">
                {STEPS.map((step, i) => (
                  <span key={step.key} className="flex items-center gap-1">
                    {i > 0 && <span className="text-slate-700 text-base leading-none">·</span>}
                    <button
                      onClick={() => goToStep(i)}
                      className={`
                        cursor-pointer bg-transparent border-none text-xs transition-colors duration-200
                        ${i === currentStep
                          ? 'text-sf-blue-light'
                          : 'text-slate-700 hover:text-slate-400'
                        }
                      `}
                    >
                      {step.label}
                    </button>
                  </span>
                ))}
              </nav>

              {/* Step counter */}
              <span className="absolute right-0 text-[10px] text-slate-700 transition-colors duration-300 group-hover/nav:text-slate-500 tabular-nums">
                {currentStep + 1} / {STEPS.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Step content with transition */}
      <div className="flex-1 overflow-x-clip relative">
        {stepKey !== 'requirements' && (
          <button
            onClick={() => setShowTitles(prev => !prev)}
            className="absolute top-3 right-4 z-10 w-6 h-6 rounded-full bg-slate-700/40 hover:bg-slate-600/60 text-slate-500 hover:text-slate-300 text-xs font-medium flex items-center justify-center cursor-pointer border-none transition-colors duration-200"
            title="Toggle page titles"
          >
            ?
          </button>
        )}
        <div
          key={transitionKey}
          className={`max-w-7xl mx-auto px-6 pt-4 pb-8 step-slide-${transitionDir}`}
        >
          <StepComponent
            data={data[stepKey]}
            onChange={(stepData) => updateData(stepKey, stepData)}
            allData={data}
            onUpdateStep={updateData}
            demoName={demoName}
            onDemoNameChange={handleDemoNameChange}
            showTitles={showTitles}
          />
        </div>
      </div>
    </div>
  )
}
