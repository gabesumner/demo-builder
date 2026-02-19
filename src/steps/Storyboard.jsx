import { useState, useCallback, useRef, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import ImageUpload from '../components/ImageUpload'
import ImageLightbox from '../components/ImageLightbox'
import AutoHideTitle from '../components/AutoHideTitle'

const DEFAULT_PANELS = [
  'Context', 'Challenge', 'Solution 1', 'Solution 2',
  'Solution 3', 'Solution 4', 'Solution 5', 'Outcome',
]

function StoryboardPanel({ id, panel, onUpdate, onExpand, isDragSource }) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id })
  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({
    id,
    disabled: !panel.image,
  })
  const textareaRef = useRef(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.minHeight = el.scrollHeight + 'px'
    el.style.height = ''
  }, [panel.text])

  return (
    <div
      ref={setDropRef}
      className={`bg-dark-surface rounded-2xl border overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.2)] transition-all flex flex-col ${isOver ? 'border-sf-blue/50 ring-1 ring-sf-blue/20' : 'border-dark-border hover:border-slate-600/50'}`}
    >
      <div className="bg-dark-bg/60 px-4 py-2.5 border-b border-dark-border flex-none">
        <input
          value={panel.label}
          onChange={e => onUpdate({ label: e.target.value })}
          className="text-xs font-semibold text-slate-400 uppercase tracking-[0.15em] bg-transparent border-none outline-none w-full placeholder-slate-600 focus:text-slate-200 transition-colors"
          placeholder="Panel title..."
        />
      </div>
      <div className="p-3 flex flex-col flex-1">
        <div
          ref={setDragRef}
          {...(panel.image ? listeners : {})}
          {...(panel.image ? attributes : {})}
          className={`flex-none transition-opacity ${isDragSource ? 'opacity-30' : ''}`}
        >
          <ImageUpload
            value={panel.image}
            onChange={img => onUpdate({ image: img })}
            className="aspect-video mb-3"
            compact
            onExpand={onExpand}
            maxDim={6000}
          />
        </div>
        <textarea
          ref={textareaRef}
          value={panel.text}
          onChange={e => onUpdate({ text: e.target.value })}
          placeholder="Add caption..."
          className="flex-1 w-full bg-transparent border border-transparent rounded-lg px-2 py-2 text-sm text-slate-300 leading-relaxed placeholder-slate-600 resize-none overflow-hidden focus:outline-none focus:bg-dark-bg/50 focus:border-sf-blue/30 hover:border-dark-border/50 transition-colors"
        />
      </div>
    </div>
  )
}

export default function Storyboard({ data, onChange, showTitles }) {
  const panels = data || DEFAULT_PANELS.map(label => ({ label, image: '', text: '' }))
  const [expandedIndex, setExpandedIndex] = useState(null)
  const [activeDragId, setActiveDragId] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function updatePanel(index, fields) {
    const next = panels.map((p, i) => i === index ? { ...p, ...fields } : p)
    onChange(next)
  }

  function handleDragStart(event) {
    setActiveDragId(event.active.id)
  }

  function handleDragEnd(event) {
    const { active, over } = event
    setActiveDragId(null)
    if (!over || active.id === over.id) return
    const fromIdx = Number(active.id)
    const toIdx = Number(over.id)
    const next = [...panels]
    const fromImage = next[fromIdx].image
    next[fromIdx] = { ...next[fromIdx], image: next[toIdx].image }
    next[toIdx] = { ...next[toIdx], image: fromImage }
    onChange(next)
  }

  // Find prev/next panels that have images
  const goPrev = useCallback(() => {
    for (let i = expandedIndex - 1; i >= 0; i--) {
      if (panels[i].image) { setExpandedIndex(i); return }
    }
  }, [expandedIndex, panels])

  const goNext = useCallback(() => {
    for (let i = expandedIndex + 1; i < panels.length; i++) {
      if (panels[i].image) { setExpandedIndex(i); return }
    }
  }, [expandedIndex, panels])

  const hasPrev = expandedIndex !== null && panels.slice(0, expandedIndex).some(p => p.image)
  const hasNext = expandedIndex !== null && panels.slice(expandedIndex + 1).some(p => p.image)
  const activeDragIndex = activeDragId !== null ? Number(activeDragId) : null

  return (
    <div className="pt-4">
      {/* Page title */}
      <AutoHideTitle className="text-center mb-12" visible={showTitles}>
        <h1 className="text-4xl font-extrabold text-white tracking-tight">Storyboard</h1>
        <p className="text-lg text-slate-400 font-light mt-2">Map out the visual narrative in 8 panels — from context to outcome.</p>
      </AutoHideTitle>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {panels.map((panel, i) => (
            <StoryboardPanel
              key={i}
              id={String(i)}
              panel={panel}
              onUpdate={fields => updatePanel(i, fields)}
              onExpand={() => setExpandedIndex(i)}
              isDragSource={activeDragIndex === i}
            />
          ))}
        </div>
        <DragOverlay>
          {activeDragIndex !== null && panels[activeDragIndex]?.image && (
            <img
              src={panels[activeDragIndex].image}
              alt="Dragging"
              className="w-48 aspect-video object-cover rounded-lg shadow-2xl opacity-80"
            />
          )}
        </DragOverlay>
      </DndContext>

      {expandedIndex !== null && panels[expandedIndex]?.image && (
        <ImageLightbox
          src={panels[expandedIndex].image}
          title={panels[expandedIndex].label}
          caption={panels[expandedIndex].text}
          onClose={() => setExpandedIndex(null)}
          onPrev={hasPrev ? goPrev : null}
          onNext={hasNext ? goNext : null}
          panelIndex={expandedIndex}
          totalPanels={panels.length}
        />
      )}
    </div>
  )
}
