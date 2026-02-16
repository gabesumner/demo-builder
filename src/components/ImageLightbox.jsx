import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function ImageLightbox({ src, onClose, title, caption, onPrev, onNext, panelIndex, totalPanels }) {
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose() }
      if (e.key === 'ArrowLeft') { e.stopImmediatePropagation(); e.preventDefault(); onPrev ? onPrev() : onClose() }
      if (e.key === 'ArrowRight') { e.stopImmediatePropagation(); e.preventDefault(); onNext ? onNext() : onClose() }
    }
    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  }, [onClose, onPrev, onNext])

  const showCounter = typeof panelIndex === 'number' && typeof totalPanels === 'number'

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center cursor-zoom-out"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer border-none transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Previous arrow */}
      {onPrev && (
        <button
          onClick={e => { e.stopPropagation(); onPrev() }}
          className="absolute left-5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer border-none transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Next arrow */}
      {onNext && (
        <button
          onClick={e => { e.stopPropagation(); onNext() }}
          className="absolute right-5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer border-none transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Content — fixed vertical structure */}
      <div
        className="flex flex-col items-center max-w-[85vw] w-full"
        onClick={e => e.stopPropagation()}
        style={{ height: '85vh' }}
      >
        {/* Top zone: counter + title — fixed height */}
        <div className="flex-none flex flex-col items-center justify-end pb-4" style={{ height: '10vh' }}>
          {showCounter && (
            <span className="text-xs font-medium text-slate-500 uppercase tracking-[0.2em] mb-2">
              {panelIndex + 1} / {totalPanels}
            </span>
          )}
          {title && (
            <h2 className="text-base font-semibold text-white/90 uppercase tracking-[0.15em] text-center">
              {title}
            </h2>
          )}
        </div>

        {/* Image zone — fixed height, image fits within */}
        <div className="flex-none flex items-center justify-center" style={{ height: '65vh' }}>
          <img
            src={src}
            alt="Full view"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>

        {/* Bottom zone: caption — fixed height */}
        <div className="flex-none flex items-start justify-center pt-4" style={{ height: '10vh' }}>
          {caption && (
            <p className="text-sm text-slate-300 max-w-5xl text-center leading-relaxed">
              {caption}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
