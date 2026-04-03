import './PostPill.css'

const EVENT_COLORS = { post: '#F2A7B0', meeting: '#A8C4D4', holiday: '#D4B896', other: '#B5C4B1' }
const EVENT_TEXT_COLORS = { post: '#8A4050', meeting: '#4A6A7A', holiday: '#7A6040', other: '#4A5A45' }

function getEventType(post) {
  if (post.platform === 'meeting' || post.content_type === 'meeting') return 'meeting'
  if (post.platform === 'holiday' || post.content_type === 'holiday') return 'holiday'
  if (post.platform === 'other-event' || post.content_type === 'other') return 'other'
  return 'post'
}

export default function PostPill({ post, onClick, showAssignee }) {
  const evType = getEventType(post)
  const bgColor = EVENT_COLORS[evType]
  const textColor = EVENT_TEXT_COLORS[evType]

  return (
    <button
      className="post-pill"
      onClick={onClick}
      style={{
        '--event-color': bgColor,
        backgroundColor: bgColor,
        color: textColor,
      }}
    >
      <span className="post-pill-text">{post.content_type || evType}</span>
      {showAssignee && (
        <span className="post-pill-assignee">{post.assigned_to?.[0]?.toUpperCase()}</span>
      )}
    </button>
  )
}

export { EVENT_COLORS, getEventType }
