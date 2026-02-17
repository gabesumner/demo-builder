import { useState, useRef, useEffect, useCallback } from 'react'
import { fileToBase64, compressImage } from '../utils/imageUtils'
import AutoHideTitle from '../components/AutoHideTitle'
import AvatarCropModal from '../components/AvatarCropModal'

const GRADIENT_PRESETS = [
  { id: 'blue-ocean', label: 'Ocean', gradient: 'linear-gradient(135deg, #0061ff 0%, #60efff 100%)' },
  { id: 'sf-brand', label: 'Salesforce', gradient: 'linear-gradient(135deg, #032d60 0%, #0176d3 50%, #1b96ff 100%)' },
  { id: 'purple-haze', label: 'Purple', gradient: 'linear-gradient(135deg, #4a00e0 0%, #8e2de2 50%, #c471ed 100%)' },
  { id: 'sunset', label: 'Sunset', gradient: 'linear-gradient(135deg, #f12711 0%, #f5af19 100%)' },
  { id: 'emerald', label: 'Emerald', gradient: 'linear-gradient(135deg, #0f9b8e 0%, #1bceae 50%, #64f4d2 100%)' },
  { id: 'midnight', label: 'Midnight', gradient: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' },
  { id: 'coral-pink', label: 'Coral', gradient: 'linear-gradient(135deg, #ee5a6f 0%, #f29263 100%)' },
  { id: 'dark-pro', label: 'Dark', gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' },
]

function getHeadlineFontSize(text) {
  const len = (text || '').length
  if (len <= 75) return '2.15rem'
  return '1.75rem'
}

const MAX_HEADLINE = 100

function getInitials(name) {
  if (!name) return '?'
  return name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

export default function Overview({ data, onChange, showTitles }) {
  const {
    headline = '', thumbnailImage = '', gradientId = 'sf-brand', imageOffset = { x: 50, y: 50 },
    socialPostText = '', posterName = '', posterTitle = '',
    posterAvatar = '', posterAvatarOffset = { x: 50, y: 50 }, posterAvatarZoom = 1, posterAvatarIsLandscape = true
  } = data || {}

  const [showAvatarModal, setShowAvatarModal] = useState(false)

  const headlineRef = useRef(null)
  const imageInputRef = useRef(null)
  const imageAreaRef = useRef(null)
  const postTextRef = useRef(null)
  const [flashPaste, setFlashPaste] = useState(false)
  const [showStyles, setShowStyles] = useState(false)

  // Drag-to-pan state
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const offsetStart = useRef({ x: 50, y: 50 })

  const activeGradient = GRADIENT_PRESETS.find(g => g.id === gradientId) || GRADIENT_PRESETS[1]

  function update(fields) {
    onChange({ ...data, ...fields })
  }

  // Sync contentEditable with headline on mount / external changes
  useEffect(() => {
    if (headlineRef.current && headlineRef.current.textContent !== headline) {
      headlineRef.current.textContent = headline
    }
  }, [headline])

  // Auto-size post textarea on mount / when value changes
  useEffect(() => {
    const el = postTextRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
  }, [socialPostText])

  // Drag-to-pan handlers
  const handleDragStart = useCallback((e) => {
    if (e.target.closest('button')) return
    e.preventDefault()
    e.stopPropagation()
    setDragging(true)
    const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX
    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY
    dragStart.current = { x: clientX, y: clientY }
    offsetStart.current = { x: imageOffset.x, y: imageOffset.y }
  }, [imageOffset])

  const handleDragMove = useCallback((e) => {
    if (!dragging) return
    e.preventDefault()
    const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX
    const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY
    const container = imageAreaRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const dx = ((clientX - dragStart.current.x) / rect.width) * -100
    const dy = ((clientY - dragStart.current.y) / rect.height) * -100
    const newX = Math.min(100, Math.max(0, offsetStart.current.x + dx))
    const newY = Math.min(100, Math.max(0, offsetStart.current.y + dy))
    update({ imageOffset: { x: Math.round(newX), y: Math.round(newY) } })
  }, [dragging, update])

  const handleDragEnd = useCallback(() => {
    setDragging(false)
  }, [])

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleDragMove)
      window.addEventListener('mouseup', handleDragEnd)
      window.addEventListener('touchmove', handleDragMove, { passive: false })
      window.addEventListener('touchend', handleDragEnd)
      return () => {
        window.removeEventListener('mousemove', handleDragMove)
        window.removeEventListener('mouseup', handleDragEnd)
        window.removeEventListener('touchmove', handleDragMove)
        window.removeEventListener('touchend', handleDragEnd)
      }
    }
  }, [dragging, handleDragMove, handleDragEnd])

  async function handleImagePaste(e) {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault()
        const blob = item.getAsFile()
        const base64 = await fileToBase64(blob)
        const compressed = await compressImage(base64)
        update({ thumbnailImage: compressed, imageOffset: { x: 50, y: 50 } })
        setFlashPaste(true)
        setTimeout(() => setFlashPaste(false), 600)
        return
      }
    }
  }

  async function handleImageFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const base64 = await fileToBase64(file)
    const compressed = await compressImage(base64)
    update({ thumbnailImage: compressed, imageOffset: { x: 50, y: 50 } })
    e.target.value = ''
  }

  return (
    <div className="max-w-[38rem] mx-auto pt-4">
      {/* Page title */}
      <AutoHideTitle className="text-center mb-10" visible={showTitles}>
        <h1 className="text-4xl font-extrabold text-white tracking-tight">Takeaway</h1>
        <p className="text-lg text-slate-400 font-light mt-2">The social post your champion shares after seeing the demo.</p>
      </AutoHideTitle>

      {/* Social Post Mockup */}
      <div className="bg-dark-surface rounded-2xl border border-dark-border overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
        {/* Header: Avatar + Name + Title */}
        <div className="p-5 pb-0">
          <div className="flex items-start gap-3">
            <div
              className="w-12 h-12 rounded-full flex-shrink-0 cursor-pointer relative group"
              onClick={() => setShowAvatarModal(true)}
              title="Edit profile photo"
            >
              {posterAvatar ? (
                <div
                  className="w-full h-full rounded-full overflow-hidden"
                  style={{
                    backgroundImage: `url(${posterAvatar})`,
                    backgroundSize: posterAvatarIsLandscape ? `auto ${posterAvatarZoom * 100}%` : `${posterAvatarZoom * 100}% auto`,
                    backgroundPosition: `${posterAvatarOffset.x}% ${posterAvatarOffset.y}%`,
                    backgroundRepeat: 'no-repeat',
                  }}
                />
              ) : (
                <div className="w-full h-full rounded-full bg-sf-blue flex items-center justify-center text-white font-bold text-sm">
                  {getInitials(posterName)}
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <svg className="w-4 h-4 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <circle cx="12" cy="13" r="3" strokeWidth={1.5} />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <input
                value={posterName}
                onChange={e => update({ posterName: e.target.value })}
                placeholder="Your Name"
                className="w-full bg-transparent text-slate-100 font-semibold text-[15px] leading-tight border-none outline-none placeholder-slate-600 hover:bg-white/5 focus:bg-white/5 rounded px-1.5 py-0.5 -ml-1.5 transition-colors"
              />
              <input
                value={posterTitle}
                onChange={e => update({ posterTitle: e.target.value })}
                placeholder="Your Title"
                className="w-full bg-transparent text-slate-500 text-xs leading-tight border-none outline-none placeholder-slate-700 hover:bg-white/5 focus:bg-white/5 rounded px-1.5 py-0.5 -ml-1.5 transition-colors"
              />
            </div>
            <div className="text-slate-600 flex-shrink-0">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </div>
          </div>
        </div>

        {/* Post text */}
        <div className="px-5 py-3">
          <textarea
            ref={postTextRef}
            value={socialPostText}
            onChange={e => update({ socialPostText: e.target.value })}
            placeholder="Write your social post..."
            rows={1}
            className="w-full bg-transparent text-slate-300 text-sm leading-relaxed border-none outline-none placeholder-slate-600 resize-none overflow-hidden hover:bg-white/5 focus:bg-white/5 rounded px-1.5 py-1 -ml-1.5 transition-colors"
          />
        </div>

        {/* Interactive Thumbnail Canvas */}
        <div
          className={`thumb-canvas-wrapper ${flashPaste ? 'paste-flash' : ''}`}
          style={{ borderRadius: 0, boxShadow: 'none' }}
          onPaste={handleImagePaste}
          tabIndex={0}
        >
          <div className="thumb-canvas" style={{ background: activeGradient.gradient }}>
            {/* Style edit button */}
            <button
              onClick={() => setShowStyles(s => !s)}
              className={`absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer border-none transition-all ${showStyles ? 'bg-white/30 text-white' : 'bg-black/20 text-white/50 hover:bg-black/40 hover:text-white/80'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </button>

            {/* Gradient picker overlay */}
            {showStyles && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-1.5 bg-black/40 backdrop-blur-md rounded-full px-3 py-2">
                {GRADIENT_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => { update({ gradientId: preset.id }); setShowStyles(false) }}
                    className={`w-7 h-7 rounded-full cursor-pointer border-2 transition-all ${gradientId === preset.id ? 'border-white scale-110' : 'border-transparent hover:scale-110 hover:border-white/40'}`}
                    style={{ background: preset.gradient }}
                    title={preset.label}
                  />
                ))}
              </div>
            )}

            {/* Play button overlay */}
            <div className="absolute inset-0 z-[4] flex items-center justify-center pointer-events-none">
              <div className="w-16 h-16 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center border border-white/10">
                <svg className="w-7 h-7 text-white/80 ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>

            {/* Sparkles */}
            <div className="thumb-sparkle thumb-sparkle-1">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="rgba(255,255,255,0.5)">
                <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41Z" />
              </svg>
            </div>
            <div className="thumb-sparkle thumb-sparkle-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(255,255,255,0.35)">
                <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41Z" />
              </svg>
            </div>
            <div className="thumb-sparkle thumb-sparkle-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.25)">
                <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41Z" />
              </svg>
            </div>

            {/* Editable headline */}
            <div className="thumb-headline-area">
              <div
                ref={headlineRef}
                contentEditable
                suppressContentEditableWarning
                onInput={e => {
                  const text = e.currentTarget.textContent || ''
                  if (text.length <= MAX_HEADLINE) {
                    update({ headline: text })
                  } else {
                    e.currentTarget.textContent = headline
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') e.preventDefault()
                }}
                data-placeholder="Click to add headline..."
                className="thumb-headline-text"
                style={{ fontSize: getHeadlineFontSize(headline) }}
              />
            </div>

            {/* Interactive image area */}
            <div
              ref={imageAreaRef}
              className="thumb-image-area"
              onClick={() => { if (!thumbnailImage) imageInputRef.current?.click() }}
            >
              {thumbnailImage ? (
                <div
                  className={`thumb-image-container group ${dragging ? 'thumb-image-dragging' : ''}`}
                  onMouseDown={handleDragStart}
                  onTouchStart={handleDragStart}
                >
                  <img
                    src={thumbnailImage}
                    alt=""
                    className="thumb-image"
                    draggable={false}
                    style={{ objectPosition: `${imageOffset.x}% ${imageOffset.y}%` }}
                  />
                  {!dragging && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center gap-2">
                      <div className="flex items-center gap-1 text-white/70 text-xs">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                        Drag to reposition
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={e => { e.stopPropagation(); imageInputRef.current?.click() }}
                          className="bg-white/20 backdrop-blur-sm text-white px-3 py-1.5 rounded text-sm border border-white/30 cursor-pointer hover:bg-white/30 transition-colors"
                        >
                          Replace
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); update({ thumbnailImage: '', imageOffset: { x: 50, y: 50 } }) }}
                          className="bg-red-500/80 backdrop-blur-sm text-white px-3 py-1.5 rounded text-sm border-none cursor-pointer hover:bg-red-500 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="thumb-image-placeholder">
                  <svg className="w-10 h-10 mb-2 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm opacity-60">Click, paste, or drop</span>
                  <span className="text-xs opacity-40 mt-1">Product screenshot</span>
                </div>
              )}
              <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
            </div>
          </div>
        </div>

        {/* Engagement bar */}
        <div className="px-5 py-3.5 border-t border-dark-border flex items-center justify-around text-slate-500 text-sm">
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
            Like
          </span>
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Comment
          </span>
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </span>
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Send
          </span>
        </div>
      </div>

      {showAvatarModal && (
        <AvatarCropModal
          image={posterAvatar}
          offset={posterAvatarOffset}
          zoom={posterAvatarZoom}
          isLandscape={posterAvatarIsLandscape}
          onSave={({ image, offset, zoom, isLandscape }) => {
            update({ posterAvatar: image, posterAvatarOffset: offset, posterAvatarZoom: zoom, posterAvatarIsLandscape: isLandscape })
            setShowAvatarModal(false)
          }}
          onClose={() => setShowAvatarModal(false)}
        />
      )}
    </div>
  )
}

export { GRADIENT_PRESETS }
