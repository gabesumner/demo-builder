import { useState } from 'react'
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

const STATUS_CYCLE = ['pending', 'completed', 'rejected']

function StatusIcon({ status, onClick }) {
  if (status === 'completed') {
    return (
      <button
        onClick={onClick}
        className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center cursor-pointer transition-all hover:scale-110 hover:bg-emerald-500/30 select-none"
        title="Status: completed"
      >
        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </button>
    )
  }
  if (status === 'rejected') {
    return (
      <button
        onClick={onClick}
        className="flex-shrink-0 w-7 h-7 rounded-full bg-red-500/10 border-2 border-red-400/40 flex items-center justify-center cursor-pointer transition-all hover:scale-110 hover:bg-red-500/20 select-none"
        title="Status: rejected"
      >
        <svg className="w-3.5 h-3.5 text-red-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    )
  }
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-7 h-7 rounded-full bg-transparent border-2 border-slate-600 flex items-center justify-center cursor-pointer transition-all hover:scale-110 hover:border-slate-400 select-none"
      title="Status: pending"
    >
      <div className="w-2 h-2 rounded-full bg-slate-600" />
    </button>
  )
}

export default function Requirements({ data, onChange, demoName, onDemoNameChange }) {
  const [newText, setNewText] = useState('')
  const [addingNew, setAddingNew] = useState(false)

  // Backward compat: old format was plain array, new format is { items, goal }
  const normalized = Array.isArray(data) ? { items: data, goal: '' } : (data || { items: [], goal: '' })
  const items = normalized.items || []
  const goal = normalized.goal || ''

  function persist(updates) {
    onChange({ ...normalized, ...updates })
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function addItem() {
    if (!newText.trim()) return
    persist({ items: [...items, { id: crypto.randomUUID(), text: newText.trim(), status: 'pending' }] })
    setNewText('')
  }

  function updateItem(id, text) {
    persist({ items: items.map(item => item.id === id ? { ...item, text } : item) })
  }

  function removeItem(id) {
    persist({ items: items.filter(item => item.id !== id) })
  }

  function cycleStatus(id) {
    persist({
      items: items.map(item => {
        if (item.id !== id) return item
        const current = item.status || 'pending'
        const nextIndex = (STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length
        return { ...item, status: STATUS_CYCLE[nextIndex] }
      })
    })
  }

  function handleDragEnd(event) {
    const { active, over } = event
    if (active.id !== over?.id) {
      const oldIndex = items.findIndex(i => i.id === active.id)
      const newIndex = items.findIndex(i => i.id === over.id)
      persist({ items: arrayMove(items, oldIndex, newIndex) })
    }
  }

  function handleItemPaste(e, index) {
    const text = e.clipboardData?.getData('text/plain')
    if (!text) return
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (lines.length <= 1) return
    e.preventDefault()
    const input = e.target
    const before = item => item.text.slice(0, input.selectionStart)
    const after = item => item.text.slice(input.selectionEnd)
    const current = items[index]
    const prefix = before(current)
    const suffix = after(current)
    const newItems = lines.map((line, i) => {
      if (i === 0) return { ...current, text: prefix + line }
      return { id: crypto.randomUUID(), text: i === lines.length - 1 ? line + suffix : line, status: 'pending' }
    })
    const next = [...items]
    next.splice(index, 1, ...newItems)
    persist({ items: next })
    setTimeout(() => {
      const inputs = input.closest('[data-req-list]')?.querySelectorAll('textarea[data-item-input]')
      inputs?.[index + lines.length - 1]?.focus()
    }, 0)
  }

  function handleNewPaste(e) {
    const text = e.clipboardData?.getData('text/plain')
    if (!text) return
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (lines.length <= 1) return
    e.preventDefault()
    const newItems = lines.map(line => ({ id: crypto.randomUUID(), text: line, status: 'pending' }))
    persist({ items: [...items, ...newItems] })
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
      const newItem = { id: crypto.randomUUID(), text: '', status: 'pending' }
      const next = [...items]
      next.splice(index + 1, 0, newItem)
      persist({ items: next })
      setTimeout(() => {
        const inputs = e.target.closest('[data-req-list]')?.querySelectorAll('textarea[data-item-input]')
        inputs?.[index + 1]?.focus()
      }, 0)
    }
  }

  return (
    <div className="max-w-2xl mx-auto pt-4">
      {/* Hero section */}
      <div className="text-center mb-8">
        <input
          type="text"
          value={demoName}
          onChange={e => onDemoNameChange(e.target.value)}
          placeholder="Demo Name"
          className="w-full bg-transparent text-4xl font-extrabold text-white border-none outline-none placeholder-slate-700 text-center tracking-tight leading-tight"
        />
        <input
          type="text"
          value={goal}
          onChange={e => persist({ goal: e.target.value })}
          placeholder="What's the one thing this demo should prove?"
          className="w-full bg-transparent text-lg text-slate-400 border-none outline-none placeholder-slate-700 text-center mt-3 font-light leading-relaxed"
        />
      </div>

      {/* Requirements section */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Requirements</span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3" data-req-list>
              {items.map((item, index) => {
                const status = item.status || 'pending'
                const isRejected = status === 'rejected'

                return (
                  <SortableItem key={item.id} id={item.id}>
                    <div className={`
                      group/item flex-1 rounded-xl transition-all duration-200 px-5 py-3.5
                      ${isRejected
                        ? 'bg-white/[0.02] border border-white/[0.04] opacity-50'
                        : status === 'completed'
                          ? 'bg-emerald-500/[0.06] border border-emerald-500/15 shadow-[0_1px_3px_rgba(0,0,0,0.2)]'
                          : 'bg-dark-surface border border-dark-border shadow-[0_1px_3px_rgba(0,0,0,0.2)]'
                      }
                    `}>
                      <div className="flex items-start gap-4">
                        <div className="pt-[1px]">
                          <StatusIcon status={status} onClick={() => cycleStatus(item.id)} />
                        </div>
                        <textarea
                          data-item-input
                          value={item.text}
                          ref={autoResize}
                          onChange={e => { updateItem(item.id, e.target.value); autoResize(e.target) }}
                          onKeyDown={e => handleItemKeyDown(e, index)}
                          onPaste={e => handleItemPaste(e, index)}
                          placeholder="Describe this requirement..."
                          rows={1}
                          className={`
                            flex-1 bg-transparent border-none outline-none resize-none overflow-hidden transition-colors placeholder-slate-700 text-[15px]
                            ${isRejected
                              ? 'text-slate-600 line-through decoration-red-500/30'
                              : 'text-slate-300'
                            }
                          `}
                          style={{ minHeight: '1.4em' }}
                        />
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-slate-700 hover:text-red-400 transition-all cursor-pointer bg-transparent border-none p-1 opacity-0 group-hover/item:opacity-100"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </SortableItem>
                )
              })}
            </div>
          </SortableContext>
        </DndContext>

        {/* Add requirement */}
        <div className="mt-4">
          {addingNew ? (
            <div className="flex items-center gap-3 pl-2">
              <div className="w-7 h-7 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-slate-700" />
              </div>
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
                placeholder="Describe this requirement..."
                className="flex-1 bg-transparent border-none outline-none text-slate-300 text-[15px] placeholder-slate-700"
              />
            </div>
          ) : (
            <button
              onClick={() => setAddingNew(true)}
              className="text-slate-600 hover:text-slate-400 text-sm cursor-pointer bg-transparent border-none transition-colors flex items-center gap-2 pl-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add requirement
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
