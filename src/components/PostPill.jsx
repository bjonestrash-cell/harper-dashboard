import './PostPill.css'

const platformStyles = {
  instagram: { className: 'platform-instagram', icon: '◎' },
  tiktok: { className: 'platform-tiktok', icon: '♪' },
  email: { className: 'platform-email', icon: '✉' },
  other: { className: 'platform-other', icon: '•' },
}

export default function PostPill({ post, onClick }) {
  const platform = platformStyles[post.platform] || platformStyles.other

  return (
    <button className={`post-pill ${platform.className}`} onClick={onClick}>
      <span className="post-pill-icon">{platform.icon}</span>
      <span className="post-pill-text">{post.content_type}</span>
    </button>
  )
}
