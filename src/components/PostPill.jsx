import './PostPill.css'

const platformStyles = {
  instagram: { className: 'platform-instagram', icon: '\u25CE' },
  tiktok: { className: 'platform-tiktok', icon: '\u266A' },
  email: { className: 'platform-email', icon: '\u2709' },
  other: { className: 'platform-other', icon: '\u2022' },
}

export default function PostPill({ post, onClick, showAssignee, currentUser }) {
  const platform = platformStyles[post.platform] || platformStyles.other

  // In master view, color-code by assignee
  const assigneeClass = showAssignee
    ? (post.assigned_to === 'natalie' ? 'assignee-natalie' : 'assignee-grace')
    : ''

  return (
    <button className={`post-pill ${platform.className} ${assigneeClass}`} onClick={onClick}>
      <span className="post-pill-icon">{platform.icon}</span>
      <span className="post-pill-text">{post.content_type}</span>
      {showAssignee && (
        <span className="post-pill-assignee">{post.assigned_to?.[0]?.toUpperCase()}</span>
      )}
    </button>
  )
}
