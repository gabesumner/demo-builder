import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { fileToBase64 } from '../utils/imageUtils'

function resizeImage(base64, maxDim = 4000) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const isLandscape = img.width >= img.height
      if (img.width <= maxDim && img.height <= maxDim) {
        resolve({ data: base64, isLandscape })
        return
      }
      const scale = maxDim / Math.max(img.width, img.height)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve({ data: canvas.toDataURL('image/jpeg', 0.7), isLandscape })
    }
    img.src = base64
  })
}

const CONTAINER_SIZE = 280
const CIRCLE_SIZE = 240

export default function AvatarCropModal({ image: initialImage, offset: initialOffset, zoom: initialZoom, isLandscape: initialIsLandscape, onSave, onClose }) {
  const [image, setImage] = useState(initialImage || '')
  const [offset, setOffset] = useState(initialOffset || { x: 50, y: 50 })
  const [zoom, setZoom] = useState(initialZoom || 1)
  const [isLandscape, setIsLandscape] = useState(initialIsLandscape !== undefined ? initialIsLandscape : true)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const offsetStart = useRef({ x: 50, y: 50 })
  const fileInputRef = useRef(null)
  const containerRef = useRef(null)

  async function loadImage(base64) {
    const result = await resizeImage(base64)
    setImage(result.data)
    setIsLandscape(result.isLandscape)
    setOffset({ x: 50, y: 50 })
    setZoom(1)
  }

  // Drag handlers
  const handleDragStart = useCallback((e) => {
    if (!image) return
    e.preventDefault()
    setDragging(true)
    const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX
    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY
    dragStart.current = { x: clientX, y: clientY }
    offsetStart.current = { ...offset }
  }, [image, offset])

  const handleDragMove = useCallback((e) => {
    if (!dragging) return
    e.preventDefault()
    const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX
    const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const dx = ((clientX - dragStart.current.x) / rect.width) * -100
    const dy = ((clientY - dragStart.current.y) / rect.height) * -100
    const newX = Math.min(100, Math.max(0, offsetStart.current.x + dx))
    const newY = Math.min(100, Math.max(0, offsetStart.current.y + dy))
    setOffset({ x: newX, y: newY })
  }, [dragging])

  const handleDragEnd = useCallback(() => setDragging(false), [])

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

  // ESC to close
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose() }
    }
    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  }, [onClose])

  // Paste support
  useEffect(() => {
    async function handlePaste(e) {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault()
          const blob = item.getAsFile()
          const base64 = await fileToBase64(blob)
          loadImage(base64)
          return
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const base64 = await fileToBase64(file)
    loadImage(base64)
    e.target.value = ''
  }

  const bgSize = isLandscape
    ? `auto ${zoom * 100}%`
    : `${zoom * 100}% auto`

  const pad = (CONTAINER_SIZE - CIRCLE_SIZE) / 2

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-dark-surface rounded-2xl border border-dark-border p-6 shadow-2xl"
        style={{ width: CONTAINER_SIZE + 60 }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-white font-semibold text-lg mb-5 text-center">Profile Photo</h3>

        {image ? (
          <>
            {/* Crop area */}
            <div
              ref={containerRef}
              className="mx-auto relative overflow-hidden rounded-xl select-none"
              style={{
                width: CONTAINER_SIZE,
                height: CONTAINER_SIZE,
                cursor: dragging ? 'grabbing' : 'grab',
              }}
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
            >
              {/* Image */}
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundImage: `url(${image})`,
                  backgroundSize: bgSize,
                  backgroundPosition: `${offset.x}% ${offset.y}%`,
                  backgroundRepeat: 'no-repeat',
                }}
              />
              {/* Circle cutout overlay */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `radial-gradient(circle ${CIRCLE_SIZE / 2}px at center, transparent ${CIRCLE_SIZE / 2 - 1}px, rgba(0,0,0,0.6) ${CIRCLE_SIZE / 2}px)`,
                }}
              />
              {/* Circle border */}
              <div
                className="absolute pointer-events-none rounded-full"
                style={{
                  width: CIRCLE_SIZE,
                  height: CIRCLE_SIZE,
                  top: pad,
                  left: pad,
                  boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.25)',
                }}
              />
            </div>

            {/* Zoom slider */}
            <div className="flex items-center gap-3 mt-4 px-2">
              <svg className="w-4 h-4 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" strokeWidth={2} />
                <path strokeLinecap="round" strokeWidth={2} d="M21 21l-4.35-4.35M8 11h6" />
              </svg>
              <input
                type="range"
                min={1}
                max={3}
                step={0.02}
                value={zoom}
                onChange={e => setZoom(parseFloat(e.target.value))}
                className="avatar-zoom-slider flex-1"
              />
              <svg className="w-4 h-4 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" strokeWidth={2} />
                <path strokeLinecap="round" strokeWidth={2} d="M21 21l-4.35-4.35M8 11h6M11 8v6" />
              </svg>
            </div>

            {/* Drag hint */}
            <p className="text-center text-slate-600 text-xs mt-2">Drag to reposition</p>
          </>
        ) : (
          /* Upload area */
          <div
            className="mx-auto flex flex-col items-center justify-center border-2 border-dashed border-slate-600 rounded-full cursor-pointer hover:border-slate-400 hover:bg-white/5 transition-colors"
            style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}
            onClick={() => fileInputRef.current?.click()}
          >
            <svg className="w-10 h-10 text-slate-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-slate-400 text-sm">Upload photo</span>
            <span className="text-slate-600 text-xs mt-1">or paste from clipboard</span>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

        {/* Action buttons */}
        <div className="flex items-center justify-between mt-5">
          <div>
            {image && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-sf-blue-light text-sm cursor-pointer bg-transparent border-none hover:underline"
              >
                Replace
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {image && (
              <button
                onClick={() => onSave({ image: '', offset: { x: 50, y: 50 }, zoom: 1, isLandscape: true })}
                className="px-3.5 py-1.5 text-sm rounded-lg bg-transparent border border-red-500/30 text-red-400 cursor-pointer hover:bg-red-500/10 transition-colors"
              >
                Remove
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-sm rounded-lg bg-transparent border border-dark-border text-slate-400 cursor-pointer hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            {image && (
              <button
                onClick={() => onSave({ image, offset, zoom, isLandscape })}
                className="px-4 py-1.5 text-sm rounded-lg bg-sf-blue text-white border-none cursor-pointer hover:bg-sf-blue-light transition-colors"
              >
                Save
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
