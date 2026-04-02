import './PresenceAvatars.css'

export default function PresenceAvatars({ users, currentUser }) {
  const others = users.filter(u => u.user !== currentUser)

  if (others.length === 0) return null

  return (
    <div className="presence-avatars">
      {others.map(u => (
        <div
          key={u.user}
          className={`presence-avatar ${u.user === 'natalie' ? 'natalie' : 'grace'}`}
          title={`${u.user} is on ${u.page || 'dashboard'}`}
        >
          {u.user[0].toUpperCase()}
        </div>
      ))}
    </div>
  )
}
