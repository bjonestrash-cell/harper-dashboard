import { format, isPast, isToday } from 'date-fns'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import './TaskCard.css'

export default function TaskCard({ task, onToggle, onClick, onDelete, onStar }) {
  const isDone = task.status === 'done'
  const isOverdue = task.due_date && isPast(new Date(task.due_date + 'T23:59:59')) && !isDone
  const isDueToday = task.due_date && isToday(new Date(task.due_date + 'T00:00:00'))

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-card ${isDone ? 'done' : ''} ${task.starred ? 'task-starred' : ''}`}
      onClick={(e) => {
        // Don't open modal if clicking star, delete, or checkbox
        if (e.target.closest('.task-star, .task-delete-btn, .checkbox, .drag-handle')) return
        onClick(task)
      }}
    >
      {onDelete && (
        <button
          className="task-delete-btn"
          onClick={(e) => {
            e.stopPropagation()
            if (window.confirm('Delete this task?')) onDelete(task.id)
          }}
        >&times;</button>
      )}
      <div className="task-card-left">
        <span className="drag-handle" {...attributes} {...listeners}>&#x2807;</span>
        <button
          className={`checkbox ${isDone ? 'checked' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onToggle(task)
          }}
        />
      </div>
      <div className="task-card-body">
        <span className={`task-title ${isDone ? 'task-title-done' : ''}`}>
          {task.title}
        </span>
        {task.description && (
          <p className="task-desc">{task.description}</p>
        )}
        <div className="task-meta">
          {task.due_date && (
            <span className={`task-due ${isOverdue ? 'overdue' : ''} ${isDueToday ? 'today' : ''}`}>
              {format(new Date(task.due_date + 'T00:00:00'), 'MMM d')}
            </span>
          )}
          <span className={`status-chip ${task.status}`}>{task.status}</span>
        </div>
      </div>
      <button
        className={`task-star ${task.starred ? 'active' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          onStar?.(task)
        }}
        title={task.starred ? 'Unstar' : 'Star'}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill={task.starred ? 'currentColor' : 'none'}>
          <path d="M8 1.5l1.8 3.7 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6z"
            stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  )
}
