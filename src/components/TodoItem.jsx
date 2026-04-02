import './TodoItem.css'

export default function TodoItem({ todo, onToggle, onDelete }) {
  return (
    <div className={`todo-item ${todo.completed ? 'completed' : ''}`}>
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
      <button className="todo-delete" onClick={() => onDelete(todo)}>×</button>
    </div>
  )
}
