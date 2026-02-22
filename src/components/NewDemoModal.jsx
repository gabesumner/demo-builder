import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function NewDemoModal({ isOpen, onClose, onCreate }) {
  const [name, setName] = useState('')
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
    onCreate(name.trim())
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
