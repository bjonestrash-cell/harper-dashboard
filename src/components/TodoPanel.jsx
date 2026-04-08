import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, createChannel } from '../lib/supabase'
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import './TodoPanel.css'

function SortableTodoItem({ todo, onToggleComplete, onToggleStar, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`todo-item ${todo.completed ? 'completed' : ''}`}
    >
      <button
        className="todo-drag-handle"
        {...attributes}
        {...listeners}
        title="Drag to reorder"
      >
        <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
          <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
          <circle cx="2" cy="7" r="1.2"/><circle cx="6" cy="7" r="1.2"/>
          <circle cx="2" cy="12" r="1.2"/><circle cx="6" cy="12" r="1.2"/>
        </svg>
      </button>

      <button
        className="todo-check"
        onClick={() => onToggleComplete(todo)}
        title={todo.completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {todo.completed ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6.5" stroke="currentColor" strokeWidth="1"/>
            <path d="M4 7l2.5 2.5L10 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6.5" stroke="currentColor" strokeWidth="1"/>
          </svg>
        )}
      </button>

      <span className="todo-text">{todo.text}</span>

      <button
        className={`todo-star ${todo.starred ? 'starred' : ''}`}
        onClick={() => onToggleStar(todo)}
        title={todo.starred ? 'Unstar' : 'Star'}
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill={todo.starred ? 'currentColor' : 'none'}>
          <path d="M6.5 1l1.4 3.1 3.4.5-2.5 2.4.6 3.4L6.5 9 3.1 10.4l.6-3.4L1.2 4.6l3.4-.5z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
        </svg>
      </button>

      <button className="todo-delete" onClick={() => onDelete(todo.id)} title="Delete">&times;</button>
    </div>
  )
}

export default function TodoPanel({ noteId, isOpen }) {
  const [todos, setTodos] = useState([])
  const [scope, setScope] = useState('note')
  const [newText, setNewText] = useState('')
  const [adding, setAdding] = useState(false)
  const inputRef = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const effectiveScope = scope === 'note' && noteId ? 'note' : 'global'

  const fetchTodos = useCallback(async () => {
    let query = supabase.from('todos').select('*')
    if (effectiveScope === 'note' && noteId) {
      query = query.eq('note_id', noteId)
    } else {
      query = query.is('note_id', null)
    }
    const { data } = await query.order('sort_order', { ascending: true }).order('created_at', { ascending: true })
    setTodos(data || [])
  }, [effectiveScope, noteId])

  useEffect(() => {
    if (!isOpen) return
    fetchTodos()
  }, [isOpen, scope, noteId])

  useEffect(() => {
    if (!isOpen) return
    const channel = createChannel('todos_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, () => {
        fetchTodos()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [isOpen, scope, noteId])

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus()
  }, [adding])

  // Sort: starred first (by created_at among themselves), then unstarred by sort_order/created_at
  const sortedTodos = [...todos].sort((a, b) => {
    if (a.starred && !b.starred) return -1
    if (!a.starred && b.starred) return 1
    return 0 // preserve DB order (sort_order, created_at)
  })

  const addTodo = async () => {
    const text = newText.trim()
    if (!text) { setAdding(false); return }
    const maxOrder = todos.reduce((max, t) => Math.max(max, t.sort_order || 0), 0)
    const record = {
      note_id: effectiveScope === 'note' ? noteId : null,
      text,
      starred: false,
      completed: false,
      sort_order: maxOrder + 1,
    }
    const { data } = await supabase.from('todos').insert([record]).select().single()
    if (data) setTodos(prev => [...prev, data])
    setNewText('')
    setAdding(false)
  }

  const toggleStar = async (todo) => {
    const updated = { ...todo, starred: !todo.starred }
    setTodos(prev => prev.map(t => t.id === todo.id ? updated : t))
    await supabase.from('todos').update({ starred: updated.starred }).eq('id', todo.id)
  }

  const toggleComplete = async (todo) => {
    const updated = { ...todo, completed: !todo.completed }
    setTodos(prev => prev.map(t => t.id === todo.id ? updated : t))
    await supabase.from('todos').update({ completed: updated.completed }).eq('id', todo.id)
  }

  const deleteTodo = async (id) => {
    setTodos(prev => prev.filter(t => t.id !== id))
    await supabase.from('todos').delete().eq('id', id)
  }

  const handleDragEnd = async (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sortedTodos.findIndex(t => t.id === active.id)
    const newIndex = sortedTodos.findIndex(t => t.id === over.id)
    const reordered = arrayMove(sortedTodos, oldIndex, newIndex)

    // Update sort_order for all items
    const updates = reordered.map((t, i) => ({ ...t, sort_order: i }))
    setTodos(updates)

    // Persist to Supabase
    for (const item of updates) {
      await supabase.from('todos').update({ sort_order: item.sort_order }).eq('id', item.id)
    }
  }

  if (!isOpen) return null

  return (
    <div className="todo-panel">
      <div className="todo-panel-header">
        <span className="todo-panel-title">To-Dos</span>
        <div className="todo-scope-toggle">
          <button
            className={`todo-scope-btn ${effectiveScope === 'note' ? 'active' : ''}`}
            onClick={() => setScope('note')}
            disabled={!noteId}
            title={!noteId ? 'No note selected' : 'Note-specific to-dos'}
          >Note</button>
          <button
            className={`todo-scope-btn ${effectiveScope === 'global' ? 'active' : ''}`}
            onClick={() => setScope('global')}
          >Global</button>
        </div>
      </div>

      <div className="todo-list">
        {sortedTodos.length === 0 && !adding && (
          <p className="todo-empty">No to-dos yet</p>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedTodos.map(t => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {sortedTodos.map(todo => (
              <SortableTodoItem
                key={todo.id}
                todo={todo}
                onToggleComplete={toggleComplete}
                onToggleStar={toggleStar}
                onDelete={deleteTodo}
              />
            ))}
          </SortableContext>
        </DndContext>

        {adding && (
          <div className="todo-add-row">
            <input
              ref={inputRef}
              className="todo-add-input"
              value={newText}
              onChange={e => setNewText(e.target.value)}
              placeholder="New to-do..."
              onKeyDown={e => {
                if (e.key === 'Enter') addTodo()
                if (e.key === 'Escape') { setNewText(''); setAdding(false) }
              }}
              onBlur={addTodo}
            />
          </div>
        )}
      </div>

      <button className="todo-add-btn" onClick={() => setAdding(true)}>
        + Add To-Do
      </button>
    </div>
  )
}
