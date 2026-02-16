import { useState } from 'react'
import AutoHideTitle from '../components/AutoHideTitle'
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
} from '@dnd-kit/sortable'
import SortableItem from '../components/SortableItem'

function getLengthColor(text) {
  if (text.length > 150) return 'text-red-400'
  if (text.length > 110) return 'text-yellow-400'
  return null
}

export default function Outline({ data, onChange, showTitles }) {
  const [newText, setNewText] = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [focusedId, setFocusedId] = useState(null)
  const items = data || []

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function addItem() {
    if (!newText.trim()) return
    const next = [...items, { id: crypto.randomUUID(), text: newText.trim(), order: items.length }]
    onChange(next)
    setNewText('')
  }

  function updateItem(id, text) {
    onChange(items.map(item => item.id === id ? { ...item, text } : item))
  }

  function removeItem(id) {
    onChange(items.filter(item => item.id !== id))
  }

  function handleDragEnd(event) {
    const { active, over } = event
    if (active.id !== over?.id) {
      const oldIndex = items.findIndex(i => i.id === active.id)
      const newIndex = items.findIndex(i => i.id === over.id)
      onChange(arrayMove(items, oldIndex, newIndex))
    }
  }

  function handleItemPaste(e, index) {
    const text = e.clipboardData?.getData('text/plain')
    if (!text) return
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (lines.length <= 1) return
    e.preventDefault()
    const el = e.target
    const before = items[index].text.slice(0, el.selectionStart)
    const after = items[index].text.slice(el.selectionEnd)
    const newItems = lines.map((line, i) => {
      if (i === 0) return { ...items[index], text: before + line }
      return { id: crypto.randomUUID(), text: i === lines.length - 1 ? line + after : line, order: items.length + i }
    })
    const next = [...items]
    next.splice(index, 1, ...newItems)
    onChange(next)
    setTimeout(() => {
      const textareas = el.closest('[data-outline-list]')?.querySelectorAll('textarea[data-outline-input]')
      textareas?.[index + lines.length - 1]?.focus()
    }, 0)
  }

  function handleNewPaste(e) {
    const text = e.clipboardData?.getData('text/plain')
    if (!text) return
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (lines.length <= 1) return
    e.preventDefault()
    const newItems = lines.map((line, i) => ({ id: crypto.randomUUID(), text: line, order: items.length + i }))
    onChange([...items, ...newItems])
    setNewText('')
    setAddingNew(false)
  }

  function autoResize(el) {
    if (!el) return
    el.style.height = '0'
    el.style.height = el.scrollHeight + 'px'
  }

  function handleItemKeyDown(e, index) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const newItem = { id: crypto.randomUUID(), text: '', order: items.length }
      const next = [...items]
      next.splice(index + 1, 0, newItem)
      onChange(next)
      setTimeout(() => {
        const textareas = e.target.closest('[data-outline-list]')?.querySelectorAll('textarea[data-outline-input]')
        textareas?.[index + 1]?.focus()
      }, 0)
    }
  }

  return (
    <div className="max-w-2xl mx-auto pt-4">
      {/* Page title */}
      <AutoHideTitle className="text-center mb-10" visible={showTitles}>
        <h1 className="text-4xl font-extrabold text-white tracking-tight">Outline</h1>
        <p className="text-lg text-slate-400 font-light mt-2">Sketch the demo flow, beat by beat. Read it top to bottom — does it move?</p>
      </AutoHideTitle>

      {items.length === 0 && !addingNew ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-dark-border">
          <p className="text-slate-500 mb-4">No outline beats yet.</p>
          <button
            onClick={() => setAddingNew(true)}
            className="text-sf-blue-light hover:text-white text-sm cursor-pointer bg-transparent border-none transition-colors flex items-center gap-2 mx-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add your first beat
          </button>
        </div>
      ) : (
        <div className="bg-dark-surface rounded-2xl border border-dark-border shadow-[0_2px_12px_rgba(0,0,0,0.2)] overflow-hidden">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
              <div className="divide-y divide-dark-border" data-outline-list>
                {items.map((item, index) => {
                  const warningColor = focusedId === item.id ? getLengthColor(item.text) : null
                  return (
                    <SortableItem key={item.id} id={item.id}>
                      <div className="group/item flex-1 flex items-start gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                        <span className="text-slate-600 text-xs font-mono tabular-nums w-5 text-right flex-shrink-0 pt-[3px] select-none">
                          {index + 1}
                        </span>
                        <textarea
                          data-outline-input
                          value={item.text}
                          ref={autoResize}
                          onChange={e => { updateItem(item.id, e.target.value); autoResize(e.target) }}
                          onFocus={() => setFocusedId(item.id)}
                          onBlur={() => setFocusedId(null)}
                          onKeyDown={e => handleItemKeyDown(e, index)}
                          onPaste={e => handleItemPaste(e, index)}
                          placeholder="What happens here..."
                          rows={1}
                          className={`flex-1 bg-transparent border-none resize-none overflow-hidden focus:outline-none ${warningColor || 'text-slate-200'} text-[15px] leading-snug placeholder-slate-700 transition-colors`}
                          style={{ minHeight: '1.4em' }}
                        />
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-slate-700 hover:text-red-400 transition-colors cursor-pointer bg-transparent border-none p-0.5 opacity-0 group-hover/item:opacity-100 flex-shrink-0 mt-[1px]"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </SortableItem>
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>

          {/* Add beat — inside the container */}
          {addingNew ? (
            <div className="flex items-start gap-3 px-5 py-3 border-t border-dark-border">
              <span className="text-slate-700 text-xs font-mono tabular-nums w-5 text-right flex-shrink-0 pt-[3px]">
                {items.length + 1}
              </span>
              <input
                type="text"
                autoFocus
                value={newText}
                onChange={e => setNewText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { addItem(); }
                  if (e.key === 'Escape') { setAddingNew(false); setNewText(''); }
                }}
                onPaste={handleNewPaste}
                onBlur={() => { if (!newText.trim()) { setAddingNew(false); } }}
                placeholder="What happens here..."
                className="flex-1 bg-transparent border-none outline-none text-slate-300 text-[15px] leading-snug placeholder-slate-700"
              />
            </div>
          ) : (
            <button
              onClick={() => setAddingNew(true)}
              className="w-full text-left text-slate-600 hover:text-slate-400 hover:bg-white/[0.02] text-sm cursor-pointer bg-transparent border-none border-t border-t-dark-border transition-colors flex items-center gap-2 px-5 py-3"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add beat
            </button>
          )}
        </div>
      )}
    </div>
  )
}
