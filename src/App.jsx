import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useMonth } from './hooks/useMonth'
import Sidebar from './components/Sidebar'
import LiveIndicator from './components/LiveIndicator'
import PresenceAvatars from './components/PresenceAvatars'
import CalendarPage from './pages/CalendarPage'
import PromotionsPage from './pages/PromotionsPage'
import TasksPage from './pages/TasksPage'
import IdeasPage from './pages/IdeasPage'
import FeedPage from './pages/FeedPage'
import NotesPage from './pages/NotesPage'
import AdminPage from './pages/AdminPage'
import { usePresence } from './hooks/usePresence'
import Modal from './components/Modal'
import CustomCursor from './components/CustomCursor'
import NotificationsPanel, { NotificationToastContainer, NotificationBell } from './components/Notifications'

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
    document.querySelector('.main-content')?.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  const { goToToday } = useMonth()
  const [currentUser, setCurrentUser] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const urlUser = params.get('user')
    if (urlUser && ['natalie', 'grace'].includes(urlUser.toLowerCase())) {
      localStorage.setItem('harper-user', urlUser.toLowerCase())
      return urlUser.toLowerCase()
    }
    return localStorage.getItem('harper-user') || null
  })

  const [showUserPrompt, setShowUserPrompt] = useState(!currentUser)
  const [showNotifications, setShowNotifications] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('harper-sidebar-collapsed') === 'true'
  })

  const location = useLocation()
  const currentPage = location.pathname.replace('/', '') || 'calendar'
  const onlineUsers = usePresence(currentUser, currentPage)

  const selectUser = (user) => {
    localStorage.setItem('harper-user', user)
    setCurrentUser(user)
    setShowUserPrompt(false)
  }

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      localStorage.setItem('harper-sidebar-collapsed', String(!prev))
      return !prev
    })
  }

  // Admin gate
  const [showAdminInput, setShowAdminInput] = useState(false)
  const [adminCode, setAdminCode] = useState('')
  const adminInputRef = useRef(null)
  const adminWrapRef = useRef(null)
  const nav = useNavigate()

  const handleAdminSubmit = (e) => {
    e.preventDefault()
    if (adminCode.toLowerCase() === 'harper') {
      sessionStorage.setItem('harper-admin', 'true')
      setShowAdminInput(false)
      setAdminCode('')
      nav('/admin')
    } else {
      setAdminCode('')
      adminInputRef.current?.focus()
    }
  }

  // Close admin input on outside click
  useEffect(() => {
    if (!showAdminInput) return
    const handleClick = (e) => {
      if (adminWrapRef.current && !adminWrapRef.current.contains(e.target)) {
        setShowAdminInput(false)
        setAdminCode('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    setTimeout(() => adminInputRef.current?.focus(), 50)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showAdminInput])

  // Enable spellcheck/autocorrect on all inputs globally
  useEffect(() => {
    const apply = () => {
      document.querySelectorAll('input, textarea').forEach(el => {
        el.setAttribute('spellcheck', 'true')
        el.setAttribute('autocorrect', 'on')
        el.setAttribute('autocapitalize', 'sentences')
      })
    }
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <CustomCursor />
      {showUserPrompt && (
        <Modal onClose={() => {}}>
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{
              fontFamily: "var(--font-logo)",
              fontSize: 32,
              letterSpacing: 5,
              marginBottom: 8,
              color: 'var(--ink)',
            }}>
              Harper
            </div>
            <p style={{
              fontSize: 13,
              fontWeight: 300,
              color: 'var(--ink-light)',
              letterSpacing: 1,
              marginBottom: 40,
            }}>
              Who are you?
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
              <button
                onClick={() => selectUser('natalie')}
                style={{
                  padding: '14px 40px',
                  background: 'var(--pink)',
                  color: 'var(--white)',
                  border: 'none',
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                Natalie
              </button>
              <button
                onClick={() => selectUser('grace')}
                style={{
                  padding: '14px 40px',
                  background: 'var(--ink)',
                  color: 'var(--white)',
                  border: 'none',
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                Grace
              </button>
            </div>
          </div>
        </Modal>
      )}

      <div className="app-layout">
        {location.pathname !== '/admin' && (
          <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} currentUser={currentUser} onNotifClick={() => setShowNotifications(true)} onCalendarClick={goToToday} />
        )}
        <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${location.pathname === '/admin' ? 'no-sidebar' : ''}`}>
          <div className="global-status">
            <div className="mobile-bell-only">
              <NotificationBell onClick={() => setShowNotifications(true)} />
            </div>
            <div className="admin-gate-wrap" ref={adminWrapRef}>
              <button
                className="admin-gate-btn"
                onClick={() => setShowAdminInput(prev => !prev)}
                title=""
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </button>
              {showAdminInput && (
                <form className="admin-gate-dropdown" onSubmit={handleAdminSubmit}>
                  <input
                    ref={adminInputRef}
                    className="admin-gate-input"
                    type="password"
                    value={adminCode}
                    onChange={e => setAdminCode(e.target.value)}
                    placeholder="Code"
                    autoComplete="off"
                  />
                </form>
              )}
            </div>
            <LiveIndicator />
          </div>

          <ScrollToTop />
          <Routes>
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/promotions" element={<PromotionsPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/feed" element={<FeedPage />} />
            <Route path="/ideas" element={<IdeasPage />} />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/calendar" replace />} />
          </Routes>
          <div className="forme-footer">powered by forme</div>
        </div>
      </div>

      {/* Notification toast popups */}
      <NotificationToastContainer />

      {/* Notification panel (slide-in from right) */}
      {showNotifications && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 499, backgroundColor: 'rgba(26,20,18,0.2)' }}
            onClick={() => setShowNotifications(false)} />
          <NotificationsPanel
            onClose={() => setShowNotifications(false)}
            onNavigate={(path) => { window.location.href = path }}
          />
        </>
      )}
    </>
  )
}
