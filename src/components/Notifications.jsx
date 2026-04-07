import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { format, parseISO } from 'date-fns'
import './Notifications.css'

// ─── Notification helpers ───
export async function sendNotification({ to, from, type, title, body, link }) {
  await supabase.from('notifications').insert({
    to_user: to,
    from_user: from,
    type: type || 'mention',
    title,
    body,
    link: link || '/todos',
    read: false,
  })
}

// Check if text mentions the other user
export function checkForMention(text, currentUser) {
  if (!text) return null
  const other = currentUser === 'natalie' ? 'grace' : 'natalie'
  const lower = text.toLowerCase()
  if (lower.includes(other) || lower.includes(`@${other}`)) {
    return other
  }
  return null
}

// ─── Bell icon for sidebar ───
export function NotificationBell({ onClick }) {
  const [count, setCount] = useState(0)
  const [pulse, setPulse] = useState(false)
  const currentUser = localStorage.getItem('harper-user') || 'natalie'

  const fetchCount = useCallback(async () => {
    const { data, count: c } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('to_user', currentUser)
      .eq('read', false)
    const newCount = c || 0
    setCount(newCount)
    // Update iOS/PWA home screen badge
    try {
      if ('setAppBadge' in navigator) {
        if (newCount > 0) navigator.setAppBadge(newCount)
        else navigator.clearAppBadge()
      }
    } catch (e) {}
    // Update browser tab title with count
    document.title = newCount > 0 ? `(${newCount}) Harper` : 'Harper'
  }, [currentUser])

  useEffect(() => {
    fetchCount()
    const channel = supabase
      .channel('notifications-bell')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          if (payload.new.to_user === currentUser) {
            setCount(prev => prev + 1)
            setPulse(true)
            setTimeout(() => setPulse(false), 2000)
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications' },
        () => fetchCount()
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications' },
        () => fetchCount()
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [currentUser, fetchCount])

  return (
    <button className={`notif-bell ${pulse ? 'pulse' : ''}`} onClick={onClick} title="Notifications">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 01-3.46 0"/>
      </svg>
      {count > 0 && <span className="notif-badge">{count > 9 ? '9+' : count}</span>}
    </button>
  )
}

// ─── Toast notification (bottom left popup) ───
export function NotificationToast({ notification, onDismiss }) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true)
      setTimeout(onDismiss, 350)
    }, 5000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  const fromName = notification.from_user === 'natalie' ? 'Natalie' : 'Grace'
  const isNatalie = notification.from_user === 'natalie'

  return (
    <div className={`notif-toast ${exiting ? 'exit' : 'enter'}`}>
      <div className="notif-toast-avatar" style={{
        backgroundColor: isNatalie ? 'var(--pink-light)' : 'var(--cream-mid)',
        color: isNatalie ? 'var(--pink-deep)' : 'var(--ink-mid)',
      }}>
        {fromName[0]}
      </div>
      <div className="notif-toast-content">
        <span className="notif-toast-from">{fromName}</span>
        <span className="notif-toast-body">{notification.title}</span>
      </div>
      <button className="notif-toast-dismiss" onClick={() => { setExiting(true); setTimeout(onDismiss, 350) }}>×</button>
    </div>
  )
}

// ─── Toast container (listens for new notifications) ───
export function NotificationToastContainer() {
  const [toasts, setToasts] = useState([])
  const currentUser = localStorage.getItem('harper-user') || 'natalie'

  useEffect(() => {
    const channel = supabase
      .channel('notifications-toast')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          if (payload.new.to_user === currentUser) {
            setToasts(prev => [...prev, payload.new])
          }
        }
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [currentUser])

  const dismiss = (id) => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <div className="notif-toast-container">
      {toasts.map(t => (
        <NotificationToast key={t.id} notification={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  )
}

// ─── Full notifications page/panel ───
export default function NotificationsPanel({ onClose, onNavigate }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [swipingId, setSwipingId] = useState(null)
  const [swipeX, setSwipeX] = useState(0)
  const touchStart = { current: 0 }
  const currentUser = localStorage.getItem('harper-user') || 'natalie'

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('to_user', currentUser)
        .order('created_at', { ascending: false })
        .limit(50)
      setNotifications(data || [])
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel('notifications-panel')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => load()
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [currentUser])

  const markRead = async (notif) => {
    await supabase.from('notifications').update({ read: true }).eq('id', notif.id)
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n))
  }

  const markAllRead = async () => {
    await supabase.from('notifications').update({ read: true }).eq('to_user', currentUser).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const deleteNotif = async (id) => {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const handleClick = (notif) => {
    markRead(notif)
    if (onNavigate && notif.link) onNavigate(notif.link)
    if (onClose) onClose()
  }

  // Mouse swipe to dismiss
  const handleMouseDown = (e, id) => {
    setSwipingId(id)
    touchStart.current = e.clientX
    setSwipeX(0)
  }
  const handleMouseMove = (e) => {
    if (!swipingId) return
    const dx = e.clientX - touchStart.current
    if (dx < 0) setSwipeX(dx) // only swipe left
  }
  const handleMouseUp = () => {
    if (swipeX < -100) deleteNotif(swipingId)
    setSwipingId(null)
    setSwipeX(0)
  }

  const capitalize = s => s ? s[0].toUpperCase() + s.slice(1) : ''

  return (
    <div className="notif-panel" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <div className="notif-panel-header">
        <span className="notif-panel-title">Notifications</span>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {notifications.some(n => !n.read) && (
            <button className="notif-mark-all" onClick={markAllRead}>Mark all read</button>
          )}
          <button className="notif-close" onClick={onClose}>×</button>
        </div>
      </div>

      <div className="notif-panel-list">
        {loading && <p className="notif-empty">Loading...</p>}
        {!loading && notifications.length === 0 && (
          <p className="notif-empty">No notifications yet</p>
        )}
        {notifications.map(n => {
          const isNatalie = n.from_user === 'natalie'
          const isSwiping = swipingId === n.id
          return (
            <div
              key={n.id}
              className={`notif-item ${n.read ? 'read' : 'unread'}`}
              style={{ transform: isSwiping ? `translateX(${swipeX}px)` : undefined }}
              onMouseDown={(e) => handleMouseDown(e, n.id)}
              onClick={() => handleClick(n)}
            >
              <div className="notif-item-dot" style={{
                backgroundColor: !n.read ? 'var(--pink)' : 'transparent',
              }} />
              <div className="notif-item-avatar" style={{
                backgroundColor: isNatalie ? 'var(--pink-light)' : 'var(--cream-mid)',
                color: isNatalie ? 'var(--pink-deep)' : 'var(--ink-mid)',
              }}>
                {capitalize(n.from_user)[0]}
              </div>
              <div className="notif-item-content">
                <span className="notif-item-title">{n.title}</span>
                {n.body && <span className="notif-item-body">{n.body}</span>}
                <span className="notif-item-time">
                  {n.created_at ? format(parseISO(n.created_at), 'MMM d, h:mm a') : ''}
                </span>
              </div>
              <button className="notif-item-delete" onClick={(e) => { e.stopPropagation(); deleteNotif(n.id) }}>×</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
