import { useState, useEffect, useRef, useCallback } from 'react'
import ImageUpload from '../components/ImageUpload'
import ImageLightbox from '../components/ImageLightbox'
import AutoHideTitle from '../components/AutoHideTitle'
import { parseHtmlTable, mapTableToRows, resolveImageSrc } from '../utils/pasteParser'
import { fileToBase64, compressImage } from '../utils/imageUtils'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function SortableGridRow({ row, index, updateRow, removeRow, setFocus, clearFocus, autoResize, setExpandedIndex, onContextMenu }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/row grid grid-cols-[28px_242px_1fr_0.81fr_40px] border-b border-dark-border last:border-b-0 transition-colors ${row.highlighted ? 'bg-amber-500/[0.07] hover:bg-amber-500/[0.11]' : 'hover:bg-white/[0.01]'}`}
      onContextMenu={e => onContextMenu(e, index)}
    >
      <div className="flex items-center justify-center">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-slate-700 hover:text-slate-500 p-0.5 bg-transparent border-none opacity-0 group-hover/row:opacity-60 hover:!opacity-100 transition-opacity"
          aria-label="Drag to reorder"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="9" cy="7" r="1.5" />
            <circle cx="15" cy="7" r="1.5" />
            <circle cx="9" cy="12" r="1.5" />
            <circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="17" r="1.5" />
            <circle cx="15" cy="17" r="1.5" />
          </svg>
        </button>
      </div>
      <div className="p-4 border-r border-dark-border" data-image-upload
        onFocus={() => setFocus(index, 'screenshot')}
        onBlur={clearFocus}
      >
        <ImageUpload
          value={row.screenshot}
          onChange={img => updateRow(index, { screenshot: img })}
          className="h-28"
          compact
          onExpand={() => setExpandedIndex(index)}
        />
      </div>
      <div className="p-4 border-r border-dark-border">
        <textarea
          value={row.talkTrack}
          onChange={e => { updateRow(index, { talkTrack: e.target.value }); autoResize(e.target) }}
          onFocus={() => setFocus(index, 'talkTrack')}
          onBlur={clearFocus}
          ref={autoResize}
          placeholder="What you say at this step..."
          className="w-full bg-transparent border border-transparent rounded-lg px-3 py-2 text-[15px] text-slate-300 leading-relaxed placeholder-slate-600 resize-none overflow-hidden focus:outline-none focus:bg-dark-bg/50 focus:border-sf-blue/30 hover:border-dark-border/50 transition-colors"
        />
      </div>
      <div className="p-4 border-r border-dark-border">
        <textarea
          value={row.clickPath}
          onChange={e => { updateRow(index, { clickPath: e.target.value }); autoResize(e.target) }}
          onFocus={() => setFocus(index, 'clickPath')}
          onBlur={clearFocus}
          ref={autoResize}
          placeholder="Navigation steps to get here..."
          className="w-full bg-transparent border border-transparent rounded-lg px-3 py-2 text-[15px] text-slate-300 leading-relaxed placeholder-slate-600 resize-none overflow-hidden focus:outline-none focus:bg-dark-bg/50 focus:border-sf-blue/30 hover:border-dark-border/50 transition-colors"
        />
      </div>
      <div className="flex items-center justify-center">
        <button
          onClick={() => removeRow(index)}
          className="text-slate-700 hover:text-red-400 transition-all cursor-pointer bg-transparent border-none p-1 opacity-0 group-hover/row:opacity-100"
          title="Delete row"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default function Grid({ data, onChange, allData, showTitles, showToast }) {
  const rows = data || []
  const [expandedIndex, setExpandedIndex] = useState(null)
  const containerRef = useRef(null)
  const focusedCellRef = useRef(null) // { rowIndex, column }
  const rowsRef = useRef(rows)
  const [contextMenu, setContextMenu] = useState(null) // { x, y, rowIndex }
  const contextMenuRef = useRef(null)
  rowsRef.current = rows

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event) {
    const { active, over } = event
    if (active.id !== over?.id) {
      const oldIndex = rows.findIndex(r => r.id === active.id)
      const newIndex = rows.findIndex(r => r.id === over.id)
      onChange(arrayMove(rows, oldIndex, newIndex))
    }
  }

  // Dismiss context menu on outside click or Escape
  useEffect(() => {
    if (!contextMenu) return
    function handleClose(e) {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) setContextMenu(null)
    }
    function handleKey(e) {
      if (e.key === 'Escape') setContextMenu(null)
    }
    document.addEventListener('mousedown', handleClose)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClose)
      document.removeEventListener('keydown', handleKey)
    }
  }, [contextMenu])

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

  function insertNewRows(rowData, atIndex) {
    const insertAt = atIndex !== undefined ? atIndex : (focusedCellRef.current ? focusedCellRef.current.rowIndex + 1 : rowsRef.current.length)
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

  function handleRowContextMenu(e, rowIndex) {
    e.preventDefault()
    const menuHeight = 190
    const menuWidth = 220
    const y = e.clientY + menuHeight > window.innerHeight ? e.clientY - menuHeight : e.clientY
    const x = e.clientX + menuWidth > window.innerWidth ? e.clientX - menuWidth : e.clientX
    setContextMenu({ x, y, rowIndex })
  }

  function insertBlankRowAt(atIndex) {
    const newRow = { id: crypto.randomUUID(), screenshot: '', talkTrack: '', clickPath: '' }
    const next = [...rowsRef.current]
    next.splice(atIndex, 0, newRow)
    onChange(next)
    setContextMenu(null)
  }

  function toggleHighlight(rowIndex) {
    const next = rowsRef.current.map((r, i) => i === rowIndex ? { ...r, highlighted: !r.highlighted } : r)
    onChange(next)
    setContextMenu(null)
  }

  async function pasteFromClipboard(atIndex) {
    setContextMenu(null)
    try {
      const clipboardItems = await navigator.clipboard.read()
      for (const item of clipboardItems) {
        // Path A: HTML table
        if (item.types.includes('text/html')) {
          const blob = await item.getType('text/html')
          const html = await blob.text()
          const parsed = parseHtmlTable(html)
          if (parsed && parsed.length > 0) {
            const mapped = mapTableToRows(parsed)
            const inserted = insertNewRows(mapped, atIndex)
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
        // Path B: Image
        const imageType = item.types.find(t => t.startsWith('image/'))
        if (imageType) {
          const placeholder = [{ screenshot: '', talkTrack: '', clickPath: '' }]
          const inserted = insertNewRows(placeholder, atIndex)
          try {
            const blob = await item.getType(imageType)
            const base64 = await fileToBase64(blob)
            const compressed = await compressImage(base64)
            const updated = rowsRef.current.map(r =>
              r.id === inserted[0].id ? { ...r, screenshot: compressed } : r
            )
            onChange(updated)
          } catch { /* leave screenshot empty */ }
          return
        }
        // Path C: Plain text
        if (item.types.includes('text/plain')) {
          const blob = await item.getType('text/plain')
          const text = await blob.text()
          const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
          if (lines.length > 0) {
            insertNewRows(lines.map(line => ({ screenshot: '', talkTrack: line, clickPath: '' })), atIndex)
          }
          return
        }
      }
    } catch { /* clipboard access denied or empty */ }
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
        <div className="grid grid-cols-[28px_242px_1fr_0.81fr_40px] bg-dark-bg/60 border-b border-dark-border">
          <div />
          <div className="px-5 py-4 border-r border-dark-border">
            <div className="font-semibold text-sm text-slate-200">What You See</div>
            <div className="text-xs text-slate-500 mt-0.5">Screenshot</div>
          </div>
          <div className="px-5 py-4 border-r border-dark-border">
            <div className="flex items-center gap-2">
              <div className="font-semibold text-sm text-slate-200">What You Say</div>
              <button
                onClick={() => {
                  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                  const html = `<ol>${rows.map(r => `<li>${esc(r.talkTrack || '')}</li>`).join('')}</ol>`
                  const plain = rows.map((r, i) => `${i + 1}. ${r.talkTrack || ''}`).join('\n')
                  try {
                    navigator.clipboard.write([new ClipboardItem({
                      'text/html': new Blob([html], { type: 'text/html' }),
                      'text/plain': new Blob([plain], { type: 'text/plain' }),
                    })])
                  } catch {
                    navigator.clipboard.writeText(plain)
                  }
                  showToast?.('Talk Track copied to clipboard')
                }}
                title="Copy talk track to clipboard"
                className="w-6 h-6 rounded-full bg-slate-700/40 hover:bg-slate-600/60 text-slate-500 hover:text-slate-300 flex items-center justify-center cursor-pointer border-none transition-colors duration-200"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={rows.map(r => r.id)} strategy={verticalListSortingStrategy}>
              {rows.map((row, i) => (
                <SortableGridRow
                  key={row.id}
                  row={row}
                  index={i}
                  updateRow={updateRow}
                  removeRow={removeRow}
                  setFocus={setFocus}
                  clearFocus={clearFocus}
                  autoResize={autoResize}
                  setExpandedIndex={setExpandedIndex}
                  onContextMenu={handleRowContextMenu}
                />
              ))}
            </SortableContext>
          </DndContext>
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

      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 9999 }}
          className="bg-dark-surface border border-dark-border rounded-xl shadow-2xl py-1.5 min-w-[210px]"
          onContextMenu={e => e.preventDefault()}
        >
          <button
            onClick={() => insertBlankRowAt(contextMenu.rowIndex)}
            className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-3 cursor-pointer bg-transparent border-none"
          >
            <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Insert blank row above
          </button>
          <button
            onClick={() => insertBlankRowAt(contextMenu.rowIndex + 1)}
            className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-3 cursor-pointer bg-transparent border-none"
          >
            <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Insert blank row below
          </button>
          <div className="border-t border-dark-border my-1.5" />
          <button
            onClick={() => pasteFromClipboard(contextMenu.rowIndex + 1)}
            className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-3 cursor-pointer bg-transparent border-none"
          >
            <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V9l-6-6z" />
            </svg>
            Paste items below
          </button>
          <div className="border-t border-dark-border my-1.5" />
          <button
            onClick={() => toggleHighlight(contextMenu.rowIndex)}
            className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-3 cursor-pointer bg-transparent border-none"
          >
            <svg className="w-4 h-4 shrink-0 text-amber-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
            </svg>
            {rows[contextMenu.rowIndex]?.highlighted ? 'Clear highlight' : 'Highlight row'}
          </button>
        </div>
      )}

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
