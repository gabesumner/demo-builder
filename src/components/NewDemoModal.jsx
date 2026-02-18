import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function NewDemoModal({ isOpen, onClose, onCreate, driveAvailable, postgresMode }) {
  const [name, setName] = useState('')
  const [storage, setStorage] = useState(() => localStorage.getItem('preferredStorage') || 'local')
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setName('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  function handleCreate() {
    if (!name.trim()) return
    localStorage.setItem('preferredStorage', storage)
    onCreate(name.trim(), storage)
    onClose()
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-dark-surface rounded-2xl border border-dark-border p-6 shadow-2xl w-[380px]"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-white mb-5">New Demo</h2>

        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          placeholder="Demo name..."
          className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-slate-200 text-[15px] placeholder-slate-600 focus:outline-none focus:border-sf-blue/40 transition-colors mb-4"
        />

        {!postgresMode && (
          <div className="mb-5">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 block">Save to</label>
            <div className="flex gap-2">
              <button
                onClick={() => setStorage('local')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border cursor-pointer transition-all ${
                  storage === 'local'
                    ? 'bg-sf-blue/10 border-sf-blue/30 text-sf-blue-light'
                    : 'bg-transparent border-dark-border text-slate-500 hover:border-slate-500 hover:text-slate-300'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                This Device
              </button>
              <button
                onClick={() => driveAvailable && setStorage('drive')}
                disabled={!driveAvailable}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border cursor-pointer transition-all ${
                  storage === 'drive'
                    ? 'bg-sf-blue/10 border-sf-blue/30 text-sf-blue-light'
                    : driveAvailable
                      ? 'bg-transparent border-dark-border text-slate-500 hover:border-slate-500 hover:text-slate-300'
                      : 'bg-transparent border-dark-border/50 text-slate-700 cursor-not-allowed'
                }`}
                title={driveAvailable ? '' : 'Sign in with Google to use Drive'}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.71 3.5L1.15 15l3.43 5.5h6.52l-3.43-5.5 3.43-5.5L7.71 3.5zm1.73 0l6.57 11.5H22.58L16.02 3.5H9.44zm6.86 12L13.16 20.5h6.56l3.14-5H16.3z" />
                </svg>
                Google Drive
              </button>
            </div>
            {!driveAvailable && (
              <p className="text-xs text-slate-600 mt-1.5 pl-1">Sign in with Google to save to Drive</p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-transparent border border-dark-border text-slate-400 cursor-pointer hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="px-5 py-2 text-sm rounded-lg bg-sf-blue text-white border-none cursor-pointer hover:bg-sf-blue-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
