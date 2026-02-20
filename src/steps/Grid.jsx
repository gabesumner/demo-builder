import { useState, useEffect, useRef, useCallback } from 'react'
import ImageUpload from '../components/ImageUpload'
import ImageLightbox from '../components/ImageLightbox'
import AutoHideTitle from '../components/AutoHideTitle'
import { parseHtmlTable, mapTableToRows, resolveImageSrc } from '../utils/pasteParser'
import { fileToBase64, compressImage } from '../utils/imageUtils'

export default function Grid({ data, onChange, allData, showTitles }) {
  const rows = data || []
  const [expandedIndex, setExpandedIndex] = useState(null)
  const containerRef = useRef(null)
  const focusedCellRef = useRef(null) // { rowIndex, column }
  const rowsRef = useRef(rows)
  rowsRef.current = rows

  // Pre-populate from outline on first visit when grid is empty
  useEffect(() => {
    if (rows.length === 0 && allData?.outline?.length > 0) {
      const initial = allData.outline.map(item => ({
        id: crypto.randomUUID(),
        screenshot: '',
        talkTrack: item.text,
        clickPath: '',
      }))
      onChange(initial)
    }
  }, []) // Only on mount

  function updateRow(index, fields) {
    const next = rows.map((r, i) => i === index ? { ...r, ...fields } : r)
    onChange(next)
  }

  function addRow() {
    onChange([...rows, { id: crypto.randomUUID(), screenshot: '', talkTrack: '', clickPath: '' }])
  }

  function removeRow(index) {
    onChange(rows.filter((_, i) => i !== index))
  }

  // --- Smart paste ---

  function insertNewRows(rowData) {
    const insertAt = focusedCellRef.current ? focusedCellRef.current.rowIndex + 1 : rowsRef.current.length
    const withIds = rowData.map(r => ({
      id: crypto.randomUUID(),
      screenshot: r.screenshot || '',
      talkTrack: r.talkTrack || '',
      clickPath: r.clickPath || '',
    }))
    const next = [...rowsRef.current]
    next.splice(insertAt, 0, ...withIds)
    onChange(next)
    return withIds
  }

  function handlePaste(e) {
    // Let ImageUpload handle its own paste
    if (e.target.closest('[data-image-upload]')) return

    const html = e.clipboardData?.getData('text/html')
    const text = e.clipboardData?.getData('text/plain')
    const imageItems = [...(e.clipboardData?.items || [])].filter(item => item.type.startsWith('image/'))
    const isTextarea = e.target.tagName === 'TEXTAREA'

    // Path A: HTML table
    if (html) {
      const parsed = parseHtmlTable(html)
      if (parsed && parsed.length > 0) {
        e.preventDefault()
        const mapped = mapTableToRows(parsed)
        const inserted = insertNewRows(mapped)
        // Resolve images asynchronously
        mapped.forEach(async (row, i) => {
          if (!row.screenshot) return
          const base64 = await resolveImageSrc(row.screenshot)
          if (!base64) return
          const compressed = await compressImage(base64)
          const updated = rowsRef.current.map(r =>
            r.id === inserted[i].id ? { ...r, screenshot: compressed } : r
          )
          onChange(updated)
        })
        return
      }
    }

    // Path B: Images only (not in a textarea)
    if (imageItems.length > 0 && !isTextarea) {
      e.preventDefault()
      const placeholders = imageItems.map(() => ({ screenshot: '', talkTrack: '', clickPath: '' }))
      const inserted = insertNewRows(placeholders)
      imageItems.forEach(async (item, i) => {
        try {
          const blob = item.getAsFile()
          const base64 = await fileToBase64(blob)
          const compressed = await compressImage(base64)
          const updated = rowsRef.current.map(r =>
            r.id === inserted[i].id ? { ...r, screenshot: compressed } : r
          )
          onChange(updated)
        } catch { /* leave screenshot empty */ }
      })
      return
    }

    // Path C: Multi-line text
    if (text) {
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      if (lines.length <= 1) return // Let browser handle single-line paste
      e.preventDefault()
      const col = focusedCellRef.current?.column || 'talkTrack'
      const newRowData = lines.map(line => ({
        screenshot: '',
        talkTrack: col === 'talkTrack' ? line : '',
        clickPath: col === 'clickPath' ? line : '',
      }))
      insertNewRows(newRowData)
      return
    }
  }

  function setFocus(rowIndex, column) {
    focusedCellRef.current = { rowIndex, column }
  }

  function clearFocus() {
    focusedCellRef.current = null
  }

  const autoResize = useCallback((el) => {
    if (!el) return
    el.style.height = '0'
    el.style.height = el.scrollHeight + 'px'
  }, [])

  // Expanded viewer navigation — only steps with screenshots
  const goPrev = useCallback(() => {
    for (let i = expandedIndex - 1; i >= 0; i--) {
      if (rows[i].screenshot) { setExpandedIndex(i); return }
    }
  }, [expandedIndex, rows])

  const goNext = useCallback(() => {
    for (let i = expandedIndex + 1; i < rows.length; i++) {
      if (rows[i].screenshot) { setExpandedIndex(i); return }
    }
  }, [expandedIndex, rows])

  const hasPrev = expandedIndex !== null && rows.slice(0, expandedIndex).some(r => r.screenshot)
  const hasNext = expandedIndex !== null && rows.slice(expandedIndex + 1).some(r => r.screenshot)

  return (
    <div className="pt-4" ref={containerRef} tabIndex={0} onPaste={handlePaste} style={{ outline: 'none' }}>
      {/* Page title */}
      <AutoHideTitle className="text-center mb-12" visible={showTitles}>
        <h1 className="text-4xl font-extrabold text-white tracking-tight">Script</h1>
        <p className="text-lg text-slate-400 font-light mt-2">Your shot list — map what viewers see, hear, and the clicks behind it.</p>
      </AutoHideTitle>

      <div className="bg-dark-surface rounded-2xl border border-dark-border overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
        {/* Header */}
        <div className="grid grid-cols-[242px_1fr_0.81fr_40px] bg-dark-bg/60 border-b border-dark-border">
          <div className="px-5 py-4 border-r border-dark-border">
            <div className="font-semibold text-sm text-slate-200">What You See</div>
            <div className="text-xs text-slate-500 mt-0.5">Screenshot</div>
          </div>
          <div className="px-5 py-4 border-r border-dark-border">
            <div className="flex items-center gap-2 group/copy">
              <div className="font-semibold text-sm text-slate-200">What You Say</div>
              <button
                onClick={() => {
                  const text = rows
                    .map((row, i) => `${i + 1}. ${row.talkTrack || ''}`)
                    .join('\n')
                  navigator.clipboard.writeText(text)
                }}
                title="Copy talk track to clipboard"
                className="opacity-0 group-hover/copy:opacity-100 transition-opacity text-slate-500 hover:text-slate-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </button>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Talk Track</div>
          </div>
          <div className="px-5 py-4 border-r border-dark-border">
            <div className="font-semibold text-sm text-slate-200">What's Happening</div>
            <div className="text-xs text-slate-500 mt-0.5">Click Path</div>
          </div>
          <div />
        </div>

        {/* Rows */}
        {rows.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            No rows yet. {allData?.outline?.length > 0 ? 'Rows will pre-populate from your outline.' : 'Add your first row below.'}
          </div>
        ) : (
          rows.map((row, i) => (
            <div key={row.id} className="group/row grid grid-cols-[242px_1fr_0.81fr_40px] border-b border-dark-border last:border-b-0 hover:bg-white/[0.01] transition-colors">
              <div className="p-4 border-r border-dark-border" data-image-upload
                onFocus={() => setFocus(i, 'screenshot')}
                onBlur={clearFocus}
              >
                <ImageUpload
                  value={row.screenshot}
                  onChange={img => updateRow(i, { screenshot: img })}
                  className="h-28"
                  compact
                  onExpand={() => setExpandedIndex(i)}
                />
              </div>
              <div className="p-4 border-r border-dark-border">
                <textarea
                  value={row.talkTrack}
                  onChange={e => { updateRow(i, { talkTrack: e.target.value }); autoResize(e.target) }}
                  onFocus={() => setFocus(i, 'talkTrack')}
                  onBlur={clearFocus}
                  ref={autoResize}
                  placeholder="What you say at this step..."
                  className="w-full bg-transparent border border-transparent rounded-lg px-3 py-2 text-[15px] text-slate-300 leading-relaxed placeholder-slate-600 resize-none overflow-hidden focus:outline-none focus:bg-dark-bg/50 focus:border-sf-blue/30 hover:border-dark-border/50 transition-colors"
                />
              </div>
              <div className="p-4 border-r border-dark-border">
                <textarea
                  value={row.clickPath}
                  onChange={e => { updateRow(i, { clickPath: e.target.value }); autoResize(e.target) }}
                  onFocus={() => setFocus(i, 'clickPath')}
                  onBlur={clearFocus}
                  ref={autoResize}
                  placeholder="Navigation steps to get here..."
                  className="w-full bg-transparent border border-transparent rounded-lg px-3 py-2 text-[15px] text-slate-300 leading-relaxed placeholder-slate-600 resize-none overflow-hidden focus:outline-none focus:bg-dark-bg/50 focus:border-sf-blue/30 hover:border-dark-border/50 transition-colors"
                />
              </div>
              <div className="flex items-center justify-center">
                <button
                  onClick={() => removeRow(i)}
                  className="text-slate-700 hover:text-red-400 transition-all cursor-pointer bg-transparent border-none p-1 opacity-0 group-hover/row:opacity-100"
                  title="Delete row"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <button
        onClick={addRow}
        className="mt-5 text-slate-600 hover:text-slate-400 text-sm cursor-pointer bg-transparent border-none transition-colors flex items-center gap-2 pl-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add row
      </button>

      {expandedIndex !== null && rows[expandedIndex]?.screenshot && (
        <ImageLightbox
          src={rows[expandedIndex].screenshot}
          caption={rows[expandedIndex].talkTrack}
          onClose={() => setExpandedIndex(null)}
          onPrev={hasPrev ? goPrev : null}
          onNext={hasNext ? goNext : null}
          panelIndex={expandedIndex}
          totalPanels={rows.length}
        />
      )}
    </div>
  )
}
