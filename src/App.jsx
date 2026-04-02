import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import LiveIndicator from './components/LiveIndicator'
import PresenceAvatars from './components/PresenceAvatars'
import CalendarPage from './pages/CalendarPage'
import PromotionsPage from './pages/PromotionsPage'
import TasksPage from './pages/TasksPage'
import NotesPage from './pages/NotesPage'
import { usePresence } from './hooks/usePresence'
import Modal from './components/Modal'

export default function App() {
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

  return (
    <>
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
        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} currentUser={currentUser} />
        <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <div style={{
            position: 'fixed',
            top: 16,
            right: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            zIndex: 40,
          }}>
            <PresenceAvatars users={onlineUsers} currentUser={currentUser} />
            <LiveIndicator />
          </div>

          <Routes>
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/promotions" element={<PromotionsPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="*" element={<Navigate to="/calendar" replace />} />
          </Routes>
        </div>
      </div>
    </>
  )
}
