import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import './TodoItem.css'

export default function TodoItem({ todo, onToggle, onDelete, onStar }) {
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
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`todo-item ${todo.completed ? 'completed' : ''} ${todo.starred ? 'starred' : ''}`}
    >
      <button className="todo-drag" {...attributes} {...listeners} title="Drag to reorder">
        <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
          <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
          <circle cx="2" cy="7" r="1.2"/><circle cx="6" cy="7" r="1.2"/>
          <circle cx="2" cy="12" r="1.2"/><circle cx="6" cy="12" r="1.2"/>
        </svg>
      </button>
      <button
        className={`checkbox ${todo.completed ? 'checked' : ''}`}
        onClick={() => onToggle(todo)}
      />
      <span className={`todo-text ${todo.completed ? 'completed-text' : ''}`}>
        {todo.text}
      </span>
      {todo.assigned_to && (
        <span className={`todo-assignee assignee-${todo.assigned_to}`}>
          {todo.assigned_to === 'both' ? 'N+G' : todo.assigned_to[0].toUpperCase()}
        </span>
      )}
      {todo.priority === 'high' && <span className="priority-dot high" />}
      <button
        className={`todo-star-btn ${todo.starred ? 'active' : ''}`}
        onClick={() => onStar(todo)}
        title={todo.starred ? 'Unstar' : 'Star'}
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill={todo.starred ? 'currentColor' : 'none'}>
          <path d="M7.5 1.5l1.6 3.5 3.9.6-2.8 2.7.7 3.9-3.4-1.8-3.4 1.8.7-3.9L2 5.6l3.9-.6z"
            stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
        </svg>
      </button>
      <button className="todo-delete" onClick={() => onDelete(todo)}>×</button>
    </div>
  )
}
