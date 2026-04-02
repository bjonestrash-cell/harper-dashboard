import { format, isPast, isToday } from 'date-fns'
import './TaskCard.css'

export default function TaskCard({ task, onToggle, onClick, onDragStart }) {
  const isDone = task.status === 'done'
  const isOverdue = task.due_date && isPast(new Date(task.due_date + 'T23:59:59')) && !isDone
  const isDueToday = task.due_date && isToday(new Date(task.due_date + 'T00:00:00'))

  return (
    <div
      className={`task-card ${isDone ? 'done' : ''}`}
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onClick={() => onClick(task)}
    >
      <div className="task-card-left">
        <span className="drag-handle" onMouseDown={(e) => e.stopPropagation()}>⠿</span>
        <button
          className={`checkbox ${isDone ? 'checked' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onToggle(task)
          }}
        />
      </div>
      <div className="task-card-body">
        <div className={`task-priority-border priority-${task.priority || 'normal'}`} />
        <span className={`task-title ${isDone ? 'completed-text' : ''}`}>
          {task.title}
        </span>
        {task.description && (
          <p className="task-desc">{task.description}</p>
        )}
        <div className="task-meta">
          {task.due_date && (
            <span className={`task-due ${isOverdue ? 'overdue' : ''} ${isDueToday ? 'today' : ''}`}>
              📅 {format(new Date(task.due_date + 'T00:00:00'), 'MMM d')}
            </span>
          )}
          <span className={`status-chip ${task.status}`}>{task.status}</span>
        </div>
      </div>
    </div>
  )
}
