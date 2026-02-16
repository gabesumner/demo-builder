import { useRef, useState } from 'react'
import { fileToBase64, compressImage } from '../utils/imageUtils'
import ImageLightbox from './ImageLightbox'

export default function ImageUpload({ value, onChange, className = '', compact = false, onExpand, maxDim }) {
  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const [flashPaste, setFlashPaste] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const base64 = await fileToBase64(file)
    const compressed = await compressImage(base64, maxDim)
    onChange(compressed)
    e.target.value = ''
  }

  async function handlePaste(e) {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault()
        const blob = item.getAsFile()
        const base64 = await fileToBase64(blob)
        const compressed = await compressImage(base64, maxDim)
        onChange(compressed)
        setFlashPaste(true)
        setTimeout(() => setFlashPaste(false), 600)
        return
      }
    }
  }

  if (value) {
    return (
      <div
        ref={containerRef}
        tabIndex={0}
        onPaste={handlePaste}
        className={`relative group outline-none rounded-lg flex items-center justify-center ${flashPaste ? 'paste-flash' : ''} ${className}`}
      >
        <img
          src={value}
          alt="Uploaded"
          className="max-w-full max-h-full rounded-lg cursor-zoom-in"
          onClick={() => onExpand ? onExpand() : setLightboxOpen(true)}
        />
        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => inputRef.current?.click()}
            title="Replace image"
            className="w-7 h-7 rounded-md bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer border-none transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
            </svg>
          </button>
          <button
            onClick={() => onChange('')}
            title="Remove image"
            className="w-7 h-7 rounded-md bg-black/60 hover:bg-red-500/90 text-white flex items-center justify-center cursor-pointer border-none transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        {lightboxOpen && <ImageLightbox src={value} onClose={() => setLightboxOpen(false)} />}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onPaste={handlePaste}
      className={`border border-dashed border-dark-border rounded-lg flex flex-col items-center justify-center text-slate-600 hover:border-slate-500 hover:text-slate-400 focus:border-sf-blue/50 focus:ring-1 focus:ring-sf-blue/20 transition-colors cursor-default bg-transparent outline-none ${flashPaste ? 'paste-flash' : ''} ${className}`}
    >
      <svg className={compact ? "w-6 h-6" : "w-8 h-8"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span className={`mt-1 ${compact ? 'text-xs' : 'text-sm'}`}>Click here, then paste</span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}
        className={`mt-1 text-sf-blue hover:text-sf-blue/80 transition-colors cursor-pointer bg-transparent border-none ${compact ? 'text-xs' : 'text-sm'}`}
      >
        or browse files
      </button>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  )
}
