import './PresenceAvatars.css'

export default function PresenceAvatars({ users, currentUser }) {
  const isOnline = (name) => users.some(u => u.user === name)

  return (
    <div className="presence-avatars">
      <div className={`presence-dot-wrap`}>
        <div className={`presence-avatar natalie`}>N</div>
        {isOnline('natalie') && <span className="presence-online-dot" />}
      </div>
      <div className={`presence-dot-wrap`}>
        <div className={`presence-avatar grace`}>G</div>
        {isOnline('grace') && <span className="presence-online-dot" />}
      </div>
    </div>
  )
}
