import { useState, useEffect, useRef } from 'react'

export default function SaveStatusIndicator({ status, storage }) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (status === 'saving' || status === 'error') {
      setVisible(true)
    } else if (status === 'saved') {
      setVisible(true)
      timerRef.current = setTimeout(() => setVisible(false), 2500)
    } else {
      setVisible(false)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [status])

  if (storage === 'local' || !visible) return null

  return (
    <span className={`flex items-center gap-1 text-[10px] transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      {status === 'saving' && (
        <>
          <svg className="w-3 h-3 text-slate-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span className="text-slate-400">Saving...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-emerald-400">Saved</span>
        </>
      )}
      {status === 'error' && (
        <>
          <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span className="text-red-400">Save failed</span>
        </>
      )}
    </span>
  )
}
