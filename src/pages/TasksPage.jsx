import { useState, useCallback } from 'react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useMonth } from '../hooks/useMonth'
import { useRealtime } from '../hooks/useRealtime'
import PageHeader from '../components/PageHeader'
import MonthSelector from '../components/MonthSelector'
import TaskCard from '../components/TaskCard'
import SwipeToDelete from '../components/SwipeToDelete'
import TodoItem from '../components/TodoItem'
import Modal from '../components/Modal'
import DatePicker from '../components/DatePicker'
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
import './TasksPage.css'

export default function TasksPage() {
  const { currentMonth } = useMonth()
  const monthStr = format(currentMonth, 'yyyy-MM-01')
  const currentUser = localStorage.getItem('harper-user') || 'natalie'
  const [isMobile] = useState(() => window.innerWidth < 768)

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const [draggedTask, setDraggedTask] = useState(null)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [taskColumn, setTaskColumn] = useState('natalie')
  const [quickAdd, setQuickAdd] = useState({ natalie: '', grace: '' })
  const [showDone, setShowDone] = useState(false)
  const [todoInput, setTodoInput] = useState('')
  const [todoAssignee, setTodoAssignee] = useState('both')
  const [todoPriority, setTodoPriority] = useState('normal')
  const [mobileColumn, setMobileColumn] = useState('natalie')

  const fetchTasks = useCallback(() =>
    supabase.from('tasks').select('*').eq('month', monthStr).order('created_at'),
    [monthStr]
  )
  const fetchTodos = useCallback(() =>
    supabase.from('todos').select('*').eq('month', monthStr).order('completed').order('created_at'),
    [monthStr]
  )

  const { data: tasks, setData: setTasks } = useRealtime('tasks', fetchTasks, [monthStr])
  const { data: todos, setData: setTodos } = useRealtime('todos', fetchTodos, [monthStr])

  const natalieTasks = tasks.filter(t => t.assigned_to === 'natalie')
  const graceTasks = tasks.filter(t => t.assigned_to === 'grace')
  const activeTasks = (list) => list.filter(t => t.status !== 'done')
  const doneTasks = (list) => list.filter(t => t.status === 'done')

  const handleToggleTask = async (task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    const { data, error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id).select()
    if (!error && data?.[0]) setTasks(prev => prev.map(t => t.id === task.id ? data[0] : t))
  }

  const handleDragStart = (e, task) => {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = 'move'
  }

  const deleteTask = async (id) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (!error) setTasks(prev => prev.filter(t => t.id !== id))
  }

  const handleDrop = async (e, targetUser) => {
    e.preventDefault()
    if (draggedTask && draggedTask.assigned_to !== targetUser) {
      const { data, error } = await supabase.from('tasks').update({ assigned_to: targetUser }).eq('id', draggedTask.id).select()
      if (!error && data?.[0]) setTasks(prev => prev.map(t => t.id === draggedTask.id ? data[0] : t))
    }
    setDraggedTask(null)
  }

  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }

  const handleQuickAdd = async (user) => {
    const title = quickAdd[user].trim()
    if (!title) return
    const { data, error } = await supabase.from('tasks').insert({ title, assigned_to: user, month: monthStr, status: 'todo' }).select()
    if (!error && data?.[0]) setTasks(prev => [...prev, data[0]])
    setQuickAdd(prev => ({ ...prev, [user]: '' }))
  }

  const handleTaskClick = (task) => { setEditingTask(task); setShowTaskModal(true) }
  const handleAddTaskModal = (user) => { setTaskColumn(user); setEditingTask(null); setShowTaskModal(true) }

  const handleStarTask = async (task) => {
    const starred = !task.starred
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, starred } : t))
    await supabase.from('tasks').update({ starred }).eq('id', task.id)
  }

  const handleTaskDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setTasks(prev => {
      const oldIndex = prev.findIndex(t => t.id === active.id)
      const newIndex = prev.findIndex(t => t.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      // Prevent starred from going below unstarred and vice versa
      const activeTask = prev[oldIndex]
      const overTask = prev[newIndex]
      if (activeTask.starred && !overTask.starred) return prev
      if (!activeTask.starred && overTask.starred) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  // Sort tasks: starred first within each user column
  const sortTaskList = (list) => [...list].sort((a, b) => {
    if (a.starred && !b.starred) return -1
    if (!a.starred && b.starred) return 1
    return 0
  })

  const handleToggleTodo = async (todo) => {
    const { data, error } = await supabase.from('todos').update({ completed: !todo.completed }).eq('id', todo.id).select()
    if (!error && data?.[0]) setTodos(prev => prev.map(t => t.id === todo.id ? data[0] : t))
  }

  const handleDeleteTodo = async (todo) => {
    const { error } = await supabase.from('todos').delete().eq('id', todo.id)
    if (!error) setTodos(prev => prev.filter(t => t.id !== todo.id))
  }

  const handleStarTodo = async (todo) => {
    const starred = !todo.starred
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, starred } : t))
    await supabase.from('todos').update({ starred }).eq('id', todo.id)
  }

  const handleTodoDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setTodos(prev => {
      const oldIndex = prev.findIndex(t => t.id === active.id)
      const newIndex = prev.findIndex(t => t.id === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  // Sort: starred first, then rest in original order
  const sortedTodos = [...todos].sort((a, b) => {
    if (a.starred && !b.starred) return -1
    if (!a.starred && b.starred) return 1
    return 0
  })

  const handleAddTodo = async () => {
    const text = todoInput.trim()
    if (!text) return
    const newTodo = { id: crypto.randomUUID(), text, month: monthStr, assigned_to: todoAssignee, priority: todoPriority, completed: false, created_at: new Date().toISOString() }
    const { data, error } = await supabase.from('todos').insert({ text, month: monthStr, assigned_to: todoAssignee, priority: todoPriority }).select()
    if (!error && data?.[0]) {
      setTodos(prev => [...prev, data[0]])
    } else {
      setTodos(prev => [...prev, newTodo])
    }
    setTodoInput('')
  }

  const doneNatalie = doneTasks(natalieTasks)
  const doneGrace = doneTasks(graceTasks)
  const totalDone = doneNatalie.length + doneGrace.length

  const renderColumn = (user, label, taskList) => {
    const sorted = sortTaskList(activeTasks(taskList))
    return (
      <div className="kanban-column"
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, user)}>
        <div className="kanban-header">
          <div className="kanban-user">
            <span className={`avatar ${user}`}>{user[0].toUpperCase()}</span>
            <span className="section-header">{label}</span>
          </div>
          <button className="kanban-add" onClick={() => handleAddTaskModal(user)}>+</button>
        </div>
        <div className="kanban-tasks">
          <DndContext
            sensors={dndSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleTaskDragEnd}
          >
            <SortableContext
              items={sorted.map(t => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {sorted.map(task => (
                <SwipeToDelete key={task.id} onDelete={() => deleteTask(task.id)}>
                  <TaskCard task={task} onToggle={handleToggleTask} onClick={handleTaskClick} onDelete={deleteTask} onStar={handleStarTask} />
                </SwipeToDelete>
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </div>
    )
  }

  return (
    <div className="tasks-page">
      <PageHeader title="To Do's" />

      <div className="page-container">
        <MonthSelector />

        {/* Mobile column toggle */}
        {isMobile && (
          <div className="view-toggle" style={{ marginBottom: 16, justifyContent: 'center', display: 'flex' }}>
            <button className={mobileColumn === 'natalie' ? 'active' : ''} onClick={() => setMobileColumn('natalie')}>Natalie</button>
            <button className={mobileColumn === 'grace' ? 'active' : ''} onClick={() => setMobileColumn('grace')}>Grace</button>
          </div>
        )}

        <div className="kanban">
          {isMobile ? (
            renderColumn(mobileColumn, mobileColumn.charAt(0).toUpperCase() + mobileColumn.slice(1),
              mobileColumn === 'natalie' ? natalieTasks : graceTasks)
          ) : (
            <>
              {renderColumn('natalie', 'Natalie', natalieTasks)}
              {renderColumn('grace', 'Grace', graceTasks)}
            </>
          )}
        </div>

        {/* Done section */}
        {totalDone > 0 && (
          <div className="done-section">
            <button className="done-toggle" onClick={() => setShowDone(!showDone)}>
              {showDone ? '\u25BE' : '\u25B8'} {totalDone} completed task{totalDone !== 1 ? 's' : ''}
            </button>
            {showDone && (
              <div className="done-tasks">
                {[...doneNatalie, ...doneGrace].map(task => (
                  <SwipeToDelete key={task.id} onDelete={() => deleteTask(task.id)}><TaskCard task={task} onToggle={handleToggleTask} onClick={handleTaskClick} onDragStart={handleDragStart} onDelete={deleteTask} /></SwipeToDelete>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Monthly Checklist */}
        <div className="monthly-todos">
          <h2 className="checklist-title">This Month's Checklist</h2>

          {/* Filter pills */}
          <div className="checklist-filters">
            <div className="checklist-filter-group">
              {['both', 'natalie', 'grace'].map(v => (
                <button key={v} onClick={() => setTodoAssignee(v)}
                  className={`checklist-pill ${todoAssignee === v ? 'active' : ''}`}>
                  {v === 'both' ? 'Both' : v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <div className="checklist-filter-group">
              {['normal', 'high', 'low'].map(v => (
                <button key={v} onClick={() => setTodoPriority(v)}
                  className={`checklist-pill ${todoPriority === v ? 'active' : ''}`}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Checklist items */}
          <div className="checklist-items">
            {sortedTodos.length === 0 && (
              <p className="checklist-empty">Nothing here yet.</p>
            )}
            <DndContext
              sensors={dndSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleTodoDragEnd}
            >
              <SortableContext
                items={sortedTodos.map(t => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {sortedTodos.map(todo => (
                  <TodoItem key={todo.id} todo={todo} onToggle={handleToggleTodo} onDelete={handleDeleteTodo} onStar={handleStarTodo} />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>
      </div>

      {/* Floating + button */}
      <button className="fab-add" onClick={() => handleAddTaskModal(currentUser)}>+</button>

      {showTaskModal && (
        <TaskModal task={editingTask} defaultUser={taskColumn} month={monthStr} setTasks={setTasks}
          onClose={() => { setShowTaskModal(false); setEditingTask(null) }} />
      )}
    </div>
  )
}

function PillSelect({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
      {options.map(opt => {
        const val = typeof opt === 'string' ? opt : opt.value
        const label = typeof opt === 'string' ? opt : opt.label
        const isActive = value === val
        return (
          <button key={val} onClick={() => onChange(val)}
            style={{
              padding: '6px 16px', borderRadius: 20, border: 'none',
              backgroundColor: isActive ? 'var(--ink)' : 'var(--cream-mid)',
              color: isActive ? 'var(--cream)' : 'var(--ink-mid)',
              fontSize: 11, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase',
              fontFamily: 'Inter, sans-serif', transition: 'all 0.2s ease',
            }}>{label}</button>
        )
      })}
    </div>
  )
}

const TODO_PLACEHOLDERS = [
  'What needs to happen?', 'Add it before you forget...', 'One more thing...',
  'Put it on the list', "What's on your mind?", 'Something to get done',
  'Add a to do...', 'What are we doing today?', 'Drop it here',
  'One thing at a time', "What's next?", 'Brain dump it',
  'Make it official', 'Write it down', 'What needs attention?',
  'Add something', "Let's get it done", 'Task at hand',
  'Note to self...', "What's the move?",
]

function TaskModal({ task, defaultUser, month, setTasks, onClose }) {
  const placeholder = TODO_PLACEHOLDERS[Math.floor(Math.random() * TODO_PLACEHOLDERS.length)]
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    assigned_to: task?.assigned_to || defaultUser,
    due_date: task?.due_date || '',
    priority: task?.priority || '#F4A7B9',
    status: task?.status || 'todo',
  })
  const [saving, setSaving] = useState(false)
  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    if (!form.title) return
    setSaving(true)
    try {
      if (task) {
        // Try Supabase first — strip fields that may not exist in DB
        const { priority: _p, ...dbUpdateForm } = form
        if (!dbUpdateForm.due_date) dbUpdateForm.due_date = null
        if (!dbUpdateForm.description) dbUpdateForm.description = null
        const { data, error } = await supabase.from('tasks').update(dbUpdateForm).eq('id', task.id).select()
        if (!error && data?.[0]) {
          setTasks(prev => prev.map(t => t.id === task.id ? data[0] : t))
        } else {
          // Fallback: update locally
          setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...form } : t))
        }
      } else {
        const newTask = { ...form, month, id: crypto.randomUUID(), created_at: new Date().toISOString() }
        // Try Supabase first — strip fields that may not exist in DB
        const { priority, ...dbForm } = form
        // Convert empty strings to null for date fields
        if (!dbForm.due_date) dbForm.due_date = null
        if (!dbForm.description) dbForm.description = null
        const { data, error } = await supabase.from('tasks').insert({ ...dbForm, month }).select()
        if (!error && data?.[0]) {
          setTasks(prev => [...prev, data[0]])
        } else {
          // Fallback: save locally
          setTasks(prev => [...prev, newTask])
        }
      }
      onClose()
    } catch (err) {
      // Even on network error, save locally
      if (!task) {
        const newTask = { ...form, month, id: crypto.randomUUID(), created_at: new Date().toISOString() }
        setTasks(prev => [...prev, newTask])
      }
      onClose()
    }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!task) return
    const { error } = await supabase.from('tasks').delete().eq('id', task.id)
    if (!error) setTasks(prev => prev.filter(t => t.id !== task.id))
    onClose()
  }

  return (
    <Modal onClose={onClose}>
      <div style={{ padding: 32, position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', fontSize: 22, color: 'var(--ink-light)', lineHeight: 1, padding: 4, transition: 'color 0.2s', cursor: 'pointer' }}
          onMouseEnter={e => e.target.style.color = 'var(--ink)'} onMouseLeave={e => e.target.style.color = 'var(--ink-light)'}>&times;</button>

        <h2 style={{ fontSize: 11, fontWeight: 500, letterSpacing: 4, textTransform: 'uppercase', color: 'var(--ink-light)', marginBottom: 32 }}>
          {task ? 'Edit To Do' : 'New To Do'}
        </h2>

        <div style={{ marginBottom: 28 }}>
          <label className="form-label">Title</label>
          <input type="text" value={form.title} onChange={(e) => update('title', e.target.value)} placeholder={placeholder} style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: 28 }}>
          <label className="form-label">Description</label>
          <textarea rows={3} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Details..." />
        </div>
        <div style={{ marginBottom: 28 }}>
          <label className="form-label">Assigned to</label>
          <PillSelect options={['natalie', 'grace']} value={form.assigned_to} onChange={(v) => update('assigned_to', v)} />
        </div>
        <div style={{ marginBottom: 28 }}>
          <label className="form-label">Due Date</label>
          <DatePicker value={form.due_date} onChange={(v) => update('due_date', v)} />
        </div>
        <div style={{ marginBottom: 28 }}>
          <label className="form-label">Color</label>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {['#F4A7B9', '#B5C4B1', '#A8C4D4', '#D4B896', '#C4A8D4', '#1A1412'].map(c => (
              <button key={c} onClick={() => update('priority', c)}
                style={{
                  width: 28, height: 28, borderRadius: '50%', border: 'none',
                  backgroundColor: c, cursor: 'pointer', transition: 'all 200ms ease',
                  outline: form.priority === c ? `2px solid ${c}` : 'none',
                  outlineOffset: 3,
                  transform: form.priority === c ? 'scale(1.15)' : 'scale(1)',
                }} />
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 32 }}>
          <label className="form-label">Status</label>
          <PillSelect options={[{ value: 'todo', label: 'To Do' }, { value: 'in-progress', label: 'In Progress' }, { value: 'done', label: 'Done' }]} value={form.status} onChange={(v) => update('status', v)} />
        </div>

        <button className="btn-save" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        {task && (
          <button style={{ marginTop: 16, color: 'var(--ink-light)', display: 'block', textAlign: 'center', width: '100%', fontSize: 11, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={handleDelete}>Delete to do</button>
        )}
      </div>
    </Modal>
  )
}
