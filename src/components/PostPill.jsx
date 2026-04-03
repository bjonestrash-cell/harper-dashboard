import './PostPill.css'

const EVENT_COLORS = { post: '#F2A7B0', meeting: '#A8C4D4', holiday: '#D4B896', other: '#B5C4B1' }

const platformStyles = {
  instagram: { className: 'platform-instagram', icon: '\u25CE' },
  tiktok: { className: 'platform-tiktok', icon: '\u266A' },
  email: { className: 'platform-email', icon: '\u2709' },
  other: { className: 'platform-other', icon: '\u2022' },
  meeting: { className: 'platform-meeting', icon: '\u25CB' },
  holiday: { className: 'platform-holiday', icon: '\u2605' },
  'other-event': { className: 'platform-other-event', icon: '\u25C6' },
}

function getEventType(post) {
  if (post.platform === 'meeting' || post.content_type === 'meeting') return 'meeting'
  if (post.platform === 'holiday' || post.content_type === 'holiday') return 'holiday'
  if (post.platform === 'other-event' || post.content_type === 'other') return 'other'
  return 'post'
}

export default function PostPill({ post, onClick, showAssignee, currentUser }) {
  const evType = getEventType(post)
  const platform = platformStyles[post.platform] || platformStyles.other
  const dotColor = EVENT_COLORS[evType]

  const assigneeClass = showAssignee
    ? (post.assigned_to === 'natalie' ? 'assignee-natalie' : 'assignee-grace')
    : ''

  return (
    <button
      className={`post-pill ${platform.className} ${assigneeClass}`}
      onClick={onClick}
      style={{ '--event-color': dotColor }}
      title={`${evType}: ${post.caption || post.content_type}`}
    >
      <span className="post-pill-dot" style={{ backgroundColor: dotColor }} />
      <span className="post-pill-text">{post.content_type || evType}</span>
      {showAssignee && (
        <span className="post-pill-assignee">{post.assigned_to?.[0]?.toUpperCase()}</span>
      )}
    </button>
  )
}

export { EVENT_COLORS, getEventType }
