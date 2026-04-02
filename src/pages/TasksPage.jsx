import { useState, useCallback } from 'react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useMonth } from '../hooks/useMonth'
import { useRealtime } from '../hooks/useRealtime'
import MonthSelector from '../components/MonthSelector'
import TaskCard from '../components/TaskCard'
import TodoItem from '../components/TodoItem'
import Modal from '../components/Modal'
import './TasksPage.css'

export default function TasksPage() {
  const { currentMonth } = useMonth()
  const monthStr = format(currentMonth, 'yyyy-MM-01')

  const [draggedTask, setDraggedTask] = useState(null)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [taskColumn, setTaskColumn] = useState('natalie')
  const [quickAdd, setQuickAdd] = useState({ natalie: '', grace: '' })
  const [showDone, setShowDone] = useState(false)
  const [todoInput, setTodoInput] = useState('')
  const [todoAssignee, setTodoAssignee] = useState('both')
  const [todoPriority, setTodoPriority] = useState('normal')

  const fetchTasks = useCallback(() =>
    supabase.from('tasks').select('*').eq('month', monthStr).order('created_at'),
    [monthStr]
  )

  const fetchTodos = useCallback(() =>
    supabase.from('todos').select('*').eq('month', monthStr).order('completed').order('created_at'),
    [monthStr]
  )

  const { data: tasks } = useRealtime('tasks', fetchTasks, [monthStr])
  const { data: todos } = useRealtime('todos', fetchTodos, [monthStr])

  const natalieTasks = tasks.filter(t => t.assigned_to === 'natalie')
  const graceTasks = tasks.filter(t => t.assigned_to === 'grace')
  const activeTasks = (list) => list.filter(t => t.status !== 'done')
  const doneTasks = (list) => list.filter(t => t.status === 'done')

  const handleToggleTask = async (task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id)
  }

  const handleDragStart = (e, task) => {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDrop = async (e, targetUser) => {
    e.preventDefault()
    if (draggedTask && draggedTask.assigned_to !== targetUser) {
      await supabase.from('tasks').update({ assigned_to: targetUser }).eq('id', draggedTask.id)
    }
    setDraggedTask(null)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleQuickAdd = async (user) => {
    const title = quickAdd[user].trim()
    if (!title) return
    await supabase.from('tasks').insert({
      title,
      assigned_to: user,
      month: monthStr,
      status: 'todo',
    })
    setQuickAdd(prev => ({ ...prev, [user]: '' }))
  }

  const handleTaskClick = (task) => {
    setEditingTask(task)
    setShowTaskModal(true)
  }

  const handleAddTaskModal = (user) => {
    setTaskColumn(user)
    setEditingTask(null)
    setShowTaskModal(true)
  }

  // Todos
  const handleToggleTodo = async (todo) => {
    await supabase.from('todos').update({ completed: !todo.completed }).eq('id', todo.id)
  }

  const handleDeleteTodo = async (todo) => {
    await supabase.from('todos').delete().eq('id', todo.id)
  }

  const handleAddTodo = async () => {
    const text = todoInput.trim()
    if (!text) return
    await supabase.from('todos').insert({
      text,
      month: monthStr,
      assigned_to: todoAssignee,
      priority: todoPriority,
    })
    setTodoInput('')
  }

  const doneNatalie = doneTasks(natalieTasks)
  const doneGrace = doneTasks(graceTasks)
  const totalDone = doneNatalie.length + doneGrace.length

  return (
    <div className="tasks-page">
      <h1 className="page-title">Tasks</h1>
      <MonthSelector />

      <div className="kanban">
        {/* Natalie Column */}
        <div
          className="kanban-column"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, 'natalie')}
        >
          <div className="kanban-header">
            <div className="kanban-user">
              <span className="avatar natalie">N</span>
              <span className="section-header">Natalie</span>
            </div>
            <button className="kanban-add" onClick={() => handleAddTaskModal('natalie')}>+</button>
          </div>

          <div className="quick-add-row">
            <input
              placeholder="Quick add task..."
              value={quickAdd.natalie}
              onChange={(e) => setQuickAdd(prev => ({ ...prev, natalie: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd('natalie')}
            />
          </div>

          <div className="kanban-tasks">
            {activeTasks(natalieTasks).map(task => (
              <TaskCard key={task.id} task={task}
                onToggle={handleToggleTask}
                onClick={handleTaskClick}
                onDragStart={handleDragStart}
              />
            ))}
          </div>
        </div>

        {/* Grace Column */}
        <div
          className="kanban-column"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, 'grace')}
        >
          <div className="kanban-header">
            <div className="kanban-user">
              <span className="avatar grace">G</span>
              <span className="section-header">Grace</span>
            </div>
            <button className="kanban-add" onClick={() => handleAddTaskModal('grace')}>+</button>
          </div>

          <div className="quick-add-row">
            <input
              placeholder="Quick add task..."
              value={quickAdd.grace}
              onChange={(e) => setQuickAdd(prev => ({ ...prev, grace: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd('grace')}
            />
          </div>

          <div className="kanban-tasks">
            {activeTasks(graceTasks).map(task => (
              <TaskCard key={task.id} task={task}
                onToggle={handleToggleTask}
                onClick={handleTaskClick}
                onDragStart={handleDragStart}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Done section */}
      {totalDone > 0 && (
        <div className="done-section">
          <button className="done-toggle" onClick={() => setShowDone(!showDone)}>
            {showDone ? '▾' : '▸'} {totalDone} completed task{totalDone !== 1 ? 's' : ''}
          </button>
          {showDone && (
            <div className="done-tasks">
              {[...doneNatalie, ...doneGrace].map(task => (
                <TaskCard key={task.id} task={task}
                  onToggle={handleToggleTask}
                  onClick={handleTaskClick}
                  onDragStart={handleDragStart}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Monthly Todos */}
      <div className="monthly-todos">
        <h2 className="section-header">This Month's Checklist</h2>
        <div className="todo-list">
          {todos.map(todo => (
            <TodoItem key={todo.id} todo={todo} onToggle={handleToggleTodo} onDelete={handleDeleteTodo} />
          ))}
        </div>
        <div className="todo-add-row">
          <input
            placeholder="Add a checklist item..."
            value={todoInput}
            onChange={(e) => setTodoInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
            style={{ flex: 1 }}
          />
          <select value={todoAssignee} onChange={(e) => setTodoAssignee(e.target.value)}>
            <option value="both">Both</option>
            <option value="natalie">Natalie</option>
            <option value="grace">Grace</option>
          </select>
          <select value={todoPriority} onChange={(e) => setTodoPriority(e.target.value)}>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="low">Low</option>
          </select>
          <button className="btn-save" style={{ width: 'auto', padding: '10px 20px' }} onClick={handleAddTodo}>Add</button>
        </div>
      </div>

      {showTaskModal && (
        <TaskModal
          task={editingTask}
          defaultUser={taskColumn}
          month={monthStr}
          onClose={() => { setShowTaskModal(false); setEditingTask(null) }}
        />
      )}
    </div>
  )
}

function TaskModal({ task, defaultUser, month, onClose }) {
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    assigned_to: task?.assigned_to || defaultUser,
    due_date: task?.due_date || '',
    priority: task?.priority || 'normal',
    status: task?.status || 'todo',
  })
  const [saving, setSaving] = useState(false)

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    if (!form.title) return
    setSaving(true)
    try {
      if (task) {
        await supabase.from('tasks').update(form).eq('id', task.id)
      } else {
        await supabase.from('tasks').insert({ ...form, month })
      }
      onClose()
    } catch (err) {
      console.error('Error saving task:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!task) return
    await supabase.from('tasks').delete().eq('id', task.id)
    onClose()
  }

  return (
    <Modal onClose={onClose}>
      <div style={{ padding: '32px' }}>
        <h2 className="section-header" style={{ marginBottom: 24 }}>
          {task ? 'Edit Task' : 'New Task'}
        </h2>

        <div className="form-group">
          <label className="form-label">Title</label>
          <input type="text" value={form.title} onChange={(e) => update('title', e.target.value)}
            placeholder="Task title" style={{ width: '100%' }} />
        </div>

        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea rows={3} value={form.description} onChange={(e) => update('description', e.target.value)}
            placeholder="Details..." style={{ width: '100%' }} />
        </div>

        <div className="form-group">
          <label className="form-label">Assigned to</label>
          <div className="pill-group">
            {['natalie', 'grace'].map(a => (
              <button key={a} className={`pill ${form.assigned_to === a ? 'active' : ''}`}
                onClick={() => update('assigned_to', a)}>{a}</button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Due Date</label>
          <input type="date" value={form.due_date} onChange={(e) => update('due_date', e.target.value)} style={{ width: '100%' }} />
        </div>

        <div className="form-group">
          <label className="form-label">Priority</label>
          <div className="pill-group">
            {['high', 'normal', 'low'].map(p => (
              <button key={p} className={`pill ${form.priority === p ? 'active' : ''}`}
                onClick={() => update('priority', p)}>{p}</button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Status</label>
          <div className="pill-group">
            {['todo', 'in-progress', 'done'].map(s => (
              <button key={s} className={`pill ${form.status === s ? 'active' : ''}`}
                onClick={() => update('status', s)}>{s}</button>
            ))}
          </div>
        </div>

        <button className="btn-save" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>

        {task && (
          <button className="promo-action"
            style={{ marginTop: 12, color: '#C0392B', display: 'block', textAlign: 'center', width: '100%' }}
            onClick={handleDelete}>
            Delete task
          </button>
        )}
      </div>
    </Modal>
  )
}
