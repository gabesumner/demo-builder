import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function MoveConfirmModal({ isOpen, direction, demoName, onConfirm, onCancel, isMoving }) {
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e) {
      if (e.key === 'Escape' && !isMoving) onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, isMoving, onCancel])

  if (!isOpen) return null

  const toDrive = direction === 'to-drive'

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" onClick={() => !isMoving && onCancel()}>
      <div
        className="bg-dark-surface rounded-2xl border border-dark-border p-6 shadow-2xl w-[400px]"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-white mb-4">
          Move to {toDrive ? 'Google Drive' : 'Local Storage'}
        </h2>

        <p className="text-slate-300 text-sm mb-4">
          Move <strong className="text-white">{demoName}</strong> to {toDrive ? 'Google Drive' : 'this device'}?
        </p>

        <div className="bg-dark-bg rounded-lg border border-dark-border p-3 mb-5">
          <p className="text-xs text-slate-400 font-medium mb-2">This will:</p>
          <ul className="text-xs text-slate-500 space-y-1">
            {toDrive ? (
              <>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">+</span>
                  Save to Demo Builder Projects folder in Drive
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">+</span>
                  Enable sharing & collaboration
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-600 mt-0.5">-</span>
                  Remove local copy
                </li>
              </>
            ) : (
              <>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">+</span>
                  Save to this browser only
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-600 mt-0.5">-</span>
                  Disable sharing & collaboration
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-600 mt-0.5">-</span>
                  Remove from Google Drive
                </li>
              </>
            )}
          </ul>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isMoving}
            className="px-4 py-2 text-sm rounded-lg bg-transparent border border-dark-border text-slate-400 cursor-pointer hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isMoving}
            className="px-5 py-2 text-sm rounded-lg bg-sf-blue text-white border-none cursor-pointer hover:bg-sf-blue-light transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {isMoving && (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {isMoving ? 'Moving...' : `Move to ${toDrive ? 'Drive' : 'Local'}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
