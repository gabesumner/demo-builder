import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getDemoData, getDemoList, updateDemoName, setThumbnailCache } from '../utils/storage'
import { getDriveDemoData } from '../utils/driveStorage'
import { getDemoDataFromApi, updateDemoNameInApi } from '../utils/apiStorage'
import { useAutosave } from '../utils/useAutosave'
import { useGoogleAuth } from '../contexts/GoogleAuthContext'
import { useStorageMode } from '../contexts/StorageModeContext'
import { useDrivePolling } from '../hooks/useDrivePolling'
import { useApiPolling } from '../hooks/useApiPolling'
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

// URL slugs for each step (same order as STEPS)
const STEP_SLUGS = ['requirements', 'overview', 'from-to', 'storyboard', 'outline', 'script', 'watch']
const SLUG_TO_INDEX = Object.fromEntries(STEP_SLUGS.map((slug, i) => [slug, i]))

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
  const { demoId, step: stepSlug } = useParams()
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(() => SLUG_TO_INDEX[stepSlug] ?? 0)
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [transitionKey, setTransitionKey] = useState(0)
  const [transitionDir, setTransitionDir] = useState('right')
  const [saveStatus, setSaveStatus] = useState('idle')
  const [pgLastModified, setPgLastModified] = useState(0)
  const isInitialMount = useRef(true)

  // Sync URL slug on mount (redirect /demo/:id → /demo/:id/requirements, or fix invalid slug)
  useEffect(() => {
    const expectedSlug = STEP_SLUGS[currentStep]
    if (stepSlug !== expectedSlug) {
      navigate(`/demo/${demoId}/${expectedSlug}`, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { ensureToken, isSignedIn } = useGoogleAuth()
  const { mode: storageMode } = useStorageMode()
  const isPostgres = storageMode === 'postgres'

  // Look up demo metadata
  const demoMeta = useMemo(() => isPostgres ? null : getDemoList().find(d => d.id === demoId), [demoId, isPostgres])
  const storage = isPostgres ? 'postgres' : (demoMeta?.storage || 'local')
  const driveFileId = demoMeta?.driveFileId || null

  // Stable token getter for hooks
  const getToken = useCallback(() => ensureToken(), [ensureToken])

  // Save status callback
  const onSaveStatus = useCallback((status) => setSaveStatus(status), [])
  const onSaveComplete = useCallback((lastModified) => {
    if (lastModified) setPgLastModified(lastModified)
  }, [])

  const save = useAutosave(demoId, {
    storage,
    driveFileId,
    getToken: storage === 'drive' ? getToken : null,
    onSaveStatus: (storage === 'drive' || storage === 'postgres') ? onSaveStatus : null,
    onSaveComplete: storage === 'postgres' ? onSaveComplete : null,
  })

  // --- Load demo data ---
  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setLoadError(null)
      try {
        if (storage === 'postgres') {
          const result = await getDemoDataFromApi(demoId)
          if (!cancelled) {
            setData(result.data)
            setPgDemoName(result.name)
            setPgLastModified(result.lastModified)
          }
        } else if (storage === 'drive' && driveFileId) {
          const token = await ensureToken()
          const driveData = await getDriveDemoData(token, driveFileId)
          if (!cancelled) setData(driveData)
        } else {
          const localData = await getDemoData(demoId)
          if (!cancelled) setData(localData)
        }
      } catch (err) {
        console.error('Failed to load demo:', err)
        if (!cancelled) {
          if (storage !== 'postgres') {
            // Try local shadow copy
            const shadow = await getDemoData(demoId)
            if (shadow && Object.keys(shadow).length > 0) {
              setData(shadow)
            } else {
              setLoadError(err)
            }
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

  // --- Polling for external changes ---
  const [lastModifiedTime, setLastModifiedTime] = useState(demoMeta?.driveModifiedTime)

  const handleExternalChange = useCallback((newData, newName, newModifiedTime) => {
    setData(newData)
    if (newName) setDemoName(newName)
    if (isPostgres) {
      setPgLastModified(newModifiedTime)
    } else {
      setLastModifiedTime(newModifiedTime)
    }
    isInitialMount.current = true // Prevent re-save of externally loaded data
    setTimeout(() => { isInitialMount.current = false }, 100)
  }, [isPostgres])

  useDrivePolling(driveFileId, lastModifiedTime, {
    enabled: storage === 'drive' && !isPostgres && isSignedIn && !isLoading,
    getToken,
    onExternalChange: handleExternalChange,
  })

  useApiPolling(demoId, pgLastModified, {
    enabled: isPostgres && !isLoading,
    onExternalChange: handleExternalChange,
  })

  // --- UI state ---
  const [showTitles, setShowTitles] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)

  function showToast(msg) {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 2000)
  }

  function getRequirementsData() {
    const reqData = data?.requirements
    const normalized = Array.isArray(reqData)
      ? { items: reqData, goal: '' }
      : (reqData || { items: [], goal: '' })
    return {
      items: (normalized.items || []).filter(i => i.text),
      goal: normalized.goal || '',
    }
  }

  function handleCopyRequirements() {
    const { items, goal } = getRequirementsData()

    function esc(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }

    const htmlParts = [`<b>${esc(demoName)}</b>`]
    if (goal) htmlParts.push(`<i>${esc(goal)}</i>`)
    if (items.length > 0) {
      htmlParts.push(`<ul>${items.map(i => `<li>${esc(i.text)}</li>`).join('')}</ul>`)
    }
    const html = htmlParts.join('<br>')

    const plainLines = [demoName]
    if (goal) plainLines.push(goal)
    if (items.length > 0) {
      plainLines.push('')
      items.forEach(i => plainLines.push(`• ${i.text}`))
    }
    const plain = plainLines.join('\n')

    try {
      navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      })])
    } catch {
      navigator.clipboard.writeText(plain)
    }

    showToast('Contents copied to clipboard')
  }

  function handleCopyOverview() {
    const overview = data?.overview || {}
    const { headline = '', socialPostText = '', posterName = '', posterTitle = '' } = overview

    function esc(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }

    const htmlParts = []
    if (posterName) {
      const namePart = posterTitle ? `${esc(posterName)} — ${esc(posterTitle)}` : esc(posterName)
      htmlParts.push(`<b>${namePart}</b>`)
    }
    if (socialPostText) htmlParts.push(`<p>${esc(socialPostText)}</p>`)
    if (headline) htmlParts.push(`<p><i>Video Thumbnail Title: ${esc(headline)}</i></p>`)
    const html = htmlParts.join('')

    const plainLines = []
    if (posterName) {
      plainLines.push(posterTitle ? `${posterName} — ${posterTitle}` : posterName)
    }
    if (socialPostText) { plainLines.push(''); plainLines.push(socialPostText) }
    if (headline) { plainLines.push(''); plainLines.push(`Video Thumbnail Title: ${headline}`) }
    const plain = plainLines.join('\n')

    try {
      navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      })])
    } catch {
      navigator.clipboard.writeText(plain)
    }

    showToast('Contents copied to clipboard')
  }

  function handleCopyFromTo() {
    const ftData = data?.fromTo || {}
    const { from = { text: '' }, to = { text: '' } } = ftData

    function esc(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }

    const html = `<b>Without the product:</b><br>${esc(from.text)}<br><br><b>With the product:</b><br>${esc(to.text)}`
    const plain = `Without the product:\n${from.text}\n\nWith the product:\n${to.text}`

    try {
      navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      })])
    } catch {
      navigator.clipboard.writeText(plain)
    }

    showToast('Contents copied to clipboard')
  }

  function handleCopyOutline() {
    const items = (data?.outline || []).filter(i => i.text)
    if (items.length === 0) return

    function esc(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }

    const html = `<ol>${items.map(i => `<li>${esc(i.text)}</li>`).join('')}</ol>`
    const plain = items.map((i, idx) => `${idx + 1}. ${i.text}`).join('\n')

    try {
      navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      })])
    } catch {
      navigator.clipboard.writeText(plain)
    }

    showToast('Contents copied to clipboard')
  }

  function handleCopyStoryboard() {
    const panels = (data?.storyboard || []).filter(p => p.label || p.text)
    if (panels.length === 0) return

    function esc(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }

    const html = panels.map(p => `<b>${esc(p.label || '')}</b><br>${esc(p.text || '')}`).join('<br><br>')
    const plain = panels.map(p => `${p.label || ''}\n${p.text || ''}`).join('\n\n')

    try {
      navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      })])
    } catch {
      navigator.clipboard.writeText(plain)
    }

    showToast('Contents copied to clipboard')
  }

  function handleCopyAll() {
    function esc(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }

    const htmlParts = []
    const plainParts = []

    // Demo title
    htmlParts.push(`<h1><b>${esc(demoName)}</b></h1>`)
    plainParts.push(demoName)

    // Requirements
    const { items: reqItems, goal } = getRequirementsData()
    if (reqItems.length > 0 || goal) {
      htmlParts.push(`<h2><br><b>Requirements</b></h2>`)
      plainParts.push('', 'Requirements')
      if (goal) { htmlParts.push(`<p><i>${esc(goal)}</i></p>`); plainParts.push(goal) }
      if (reqItems.length > 0) {
        htmlParts.push(`<ul>${reqItems.map(i => `<li>${esc(i.text)}</li>`).join('')}</ul>`)
        reqItems.forEach(i => plainParts.push(`• ${i.text}`))
      }
    }

    // Takeaway
    const overview = data?.overview || {}
    const { headline = '', socialPostText = '', posterName = '', posterTitle = '' } = overview
    if (posterName || socialPostText || headline) {
      htmlParts.push(`<h2><br><b>Takeaway</b></h2>`)
      plainParts.push('', 'Takeaway')
      if (posterName) {
        const namePart = posterTitle ? `${esc(posterName)} — ${esc(posterTitle)}` : esc(posterName)
        htmlParts.push(`<p><b>${namePart}</b></p>`)
        plainParts.push(posterTitle ? `${posterName} — ${posterTitle}` : posterName)
      }
      if (socialPostText) { htmlParts.push(`<p>${esc(socialPostText)}</p>`); plainParts.push(socialPostText) }
      if (headline) { htmlParts.push(`<p><i>Video Thumbnail Title: ${esc(headline)}</i></p>`); plainParts.push(`Video Thumbnail Title: ${headline}`) }
    }

    // From/To Shift
    const ftData = data?.fromTo || {}
    const { from = { text: '' }, to = { text: '' } } = ftData
    if (from.text || to.text) {
      htmlParts.push(`<h2><br><b>From/To Shift</b></h2>`)
      plainParts.push('', 'From/To Shift')
      htmlParts.push(`<ul><li>Without the product${from.text ? `<ul><li>${esc(from.text)}</li></ul>` : ''}</li><li>With the product${to.text ? `<ul><li>${esc(to.text)}</li></ul>` : ''}</li></ul>`)
      plainParts.push(`• Without the product${from.text ? `\n  • ${from.text}` : ''}`, `• With the product${to.text ? `\n  • ${to.text}` : ''}`)
    }

    // Storyboard
    const panels = (data?.storyboard || []).filter(p => p.label || p.text)
    if (panels.length > 0) {
      htmlParts.push(`<h2><br><b>Storyboard</b></h2>`)
      plainParts.push('', 'Storyboard')
      htmlParts.push(`<ul>${panels.map(p => `<li><b>${esc(p.label || '')}</b>${p.text ? `<ul><li>${esc(p.text)}</li></ul>` : ''}</li>`).join('')}</ul>`)
      panels.forEach(p => plainParts.push(`• ${p.label || ''}${p.text ? `\n  • ${p.text}` : ''}`))
    }

    // Outline
    const outlineItems = (data?.outline || []).filter(i => i.text)
    if (outlineItems.length > 0) {
      htmlParts.push(`<h2><br><b>Outline</b></h2>`)
      plainParts.push('', 'Outline')
      htmlParts.push(`<ol>${outlineItems.map(i => `<li>${esc(i.text)}</li>`).join('')}</ol>`)
      outlineItems.forEach((i, idx) => plainParts.push(`${idx + 1}. ${i.text}`))
    }

    // Script (Talk Track)
    const gridRows = (data?.grid || []).filter(r => r.talkTrack)
    if (gridRows.length > 0) {
      htmlParts.push(`<h2><br><b>Script</b></h2>`)
      plainParts.push('', 'Script')
      htmlParts.push(`<ol>${gridRows.map(r => `<li>${esc(r.talkTrack || '')}</li>`).join('')}</ol>`)
      gridRows.forEach((r, idx) => plainParts.push(`${idx + 1}. ${r.talkTrack || ''}`))
    }

    if (htmlParts.length <= 1) return

    const html = htmlParts.join('')
    const plain = plainParts.join('\n')

    try {
      navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      })])
    } catch {
      navigator.clipboard.writeText(plain)
    }

    showToast('All contents copied to clipboard')
  }

  function handleCopyPrompt() {
    const { items, goal } = getRequirementsData()
    const sep = '-------------------------'
    const numbered = items.map((item, i) => `${i + 1}. ${item.text}`).join('\n')

    const prompt = `Your job is to suggest improvements to the following demo goal and requirements:

${sep}
${demoName}
Goal: ${goal}
${numbered}
${sep}

Suggest improvements that make the goal and sub-items:
1. Punchy and direct — Remove unnecessary words. Make every word count.
2. Consistent in structure — All sub-items should follow the same grammatical pattern and level of specificity.
3. Outcome-focused — Emphasize what the product delivers or does, not generic capabilities.
4. Product-specific — Use the product name as the subject. Show what choosing this product gets you, not what the category of products can do.
5. Distinct and clear — Each sub-item should represent a clearly different aspect or capability. Avoid overlap.
6. Demo-ready — Each item should be easy to visualize as a concrete demo moment, not abstract concepts.

What to avoid:
1. Don't add marketing superlatives ("superior," "best-in-class," "revolutionary")
2. Don't make up new capabilities that you can't verify exists.
3. Don't make things longer or more abstract
4. Don't remove "Show how" from the items
5. Don't make items overlap — each should be clearly distinct

Format your response:
First, provide your improved version preserving the exact format above (title, goal, subheading, numbered items).
Then, explain your rationale for the changes.

If something is already strong, keep it and note why it works in your rationale.`

    navigator.clipboard.writeText(prompt)
    showToast('Prompt copied to clipboard')
  }

  const [pgDemoName, setPgDemoName] = useState(null)
  const [demoName, setDemoName] = useState(() => {
    if (isPostgres) return 'Loading...'
    const info = getDemoList().find(d => d.id === demoId)
    return info?.name || 'Untitled Demo'
  })

  // Update demoName once pgDemoName is loaded
  useEffect(() => {
    if (pgDemoName !== null) setDemoName(pgDemoName)
  }, [pgDemoName])

  async function handleDemoNameChange(newName) {
    setDemoName(newName)
    if (isPostgres) {
      try {
        const result = await updateDemoNameInApi(demoId, newName)
        if (result?.lastModified) setPgLastModified(result.lastModified)
      } catch (err) {
        console.error('Failed to update demo name:', err)
      }
    } else {
      updateDemoName(demoId, newName)
    }
  }

  const updateData = useCallback((stepKey, stepData) => {
    setData(prev => ({ ...prev, [stepKey]: stepData }))
  }, [])

  function goToStep(newStep) {
    if (newStep === currentStep || newStep < 0 || newStep >= STEPS.length) return
    setTransitionDir(newStep > currentStep ? 'right' : 'left')
    setCurrentStep(newStep)
    setTransitionKey(prev => prev + 1)
    navigate(`/demo/${demoId}/${STEP_SLUGS[newStep]}`, { replace: true })
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
            {storage === 'drive' ? 'Loading from Google Drive...' : storage === 'postgres' ? 'Loading from server...' : 'Loading...'}
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
                <button
                  onClick={handleCopyAll}
                  className="text-slate-700 hover:text-slate-400 transition-colors cursor-pointer bg-transparent border-none p-0 flex-shrink-0"
                  title="Copy all contents to clipboard"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                  </svg>
                </button>
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
                        cursor-pointer bg-transparent border-none outline-none text-xs transition-colors duration-200
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
        <div className="absolute top-3 right-4 z-10 flex flex-col gap-2 items-center">
          {(stepKey === 'requirements' || stepKey === 'overview' || stepKey === 'fromTo' || stepKey === 'outline' || stepKey === 'storyboard') && (
            <button
              onClick={{ requirements: handleCopyRequirements, overview: handleCopyOverview, fromTo: handleCopyFromTo, outline: handleCopyOutline, storyboard: handleCopyStoryboard }[stepKey]}
              className="w-6 h-6 rounded-full bg-slate-700/40 hover:bg-slate-600/60 text-slate-500 hover:text-slate-300 flex items-center justify-center cursor-pointer border-none transition-colors duration-200"
              title="Copy to clipboard"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
              </svg>
            </button>
          )}
          {stepKey === 'requirements' && (
            <button
              onClick={handleCopyPrompt}
              className="w-6 h-6 rounded-full bg-slate-700/40 hover:bg-slate-600/60 text-slate-500 hover:text-slate-300 flex items-center justify-center cursor-pointer border-none transition-colors duration-200"
              title="Copy AI prompt"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
              </svg>
            </button>
          )}
          {stepKey !== 'requirements' && (
            <button
              onClick={() => setShowTitles(prev => !prev)}
              className="w-6 h-6 rounded-full bg-slate-700/40 hover:bg-slate-600/60 text-slate-500 hover:text-slate-300 text-xs font-medium flex items-center justify-center cursor-pointer border-none transition-colors duration-200"
              title="Toggle page titles"
            >
              ?
            </button>
          )}
        </div>
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
            showToast={showToast}
          />
        </div>
      </div>
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 z-50 bg-slate-800 text-slate-200 text-sm px-4 py-2 rounded-lg shadow-lg border border-slate-700/50 toast-appear">
          {toastMessage}
        </div>
      )}
    </div>
  )
}
