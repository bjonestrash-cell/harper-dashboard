import { useRef } from 'react'
import './PostPill.css'

const EVENT_COLORS = { post: '#ED95A0', meeting: '#96B8CC', holiday: '#CCAA82', other: '#A4B89E' }
const EVENT_TEXT_COLORS = { post: '#6E2838', meeting: '#2E4E5E', holiday: '#5E4420', other: '#2E4228' }

function getEventType(post) {
  if (post.platform === 'meeting' || post.content_type === 'meeting') return 'meeting'
  if (post.platform === 'holiday' || post.content_type === 'holiday') return 'holiday'
  if (post.platform === 'other-event' || post.content_type === 'other') return 'other'
  return 'post'
}

export default function PostPill({ post, onClick, showAssignee, draggable, onDragStart }) {
  const didDrag = useRef(false)
  const evType = getEventType(post)
  const bgColor = EVENT_COLORS[evType]
  const textColor = EVENT_TEXT_COLORS[evType]

  return (
    <button
      className="post-pill"
      onClick={draggable ? (e) => { if (didDrag.current) { didDrag.current = false; return } onClick && onClick(e) } : onClick}
      draggable={draggable}
      onDragStart={draggable ? (e) => { e.stopPropagation(); didDrag.current = true; onDragStart && onDragStart(e) } : undefined}
      onDragEnd={draggable ? () => { setTimeout(() => { didDrag.current = false }, 0) } : undefined}
      style={{
        '--event-color': bgColor,
        backgroundColor: bgColor,
        color: textColor,
        cursor: draggable ? 'grab' : 'pointer',
      }}
    >
      <span className="post-pill-text">{post.caption || post.content_type || evType}</span>
      {showAssignee && (
        <span className="post-pill-assignee">{post.assigned_to?.[0]?.toUpperCase()}</span>
      )}
    </button>
  )
}

export { EVENT_COLORS, getEventType }
