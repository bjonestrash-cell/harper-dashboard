import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import './Sidebar.css'

const navItems = [
  { path: '/calendar', label: 'Calendar', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="4" width="18" height="18" rx="1"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
    </svg>
  )},
  { path: '/promotions', label: 'Promotions', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  )},
  { path: '/tasks', label: "To Do's", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
    </svg>
  )},
  { path: '/ideas', label: 'Ideas', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z"/>
    </svg>
  )},
  { path: '/notes', label: 'Notes', sidebarLabel: 'Meeting Notes', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  )},
]

export default function Sidebar({ collapsed, onToggle, currentUser }) {
  const location = useLocation()
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Mobile: bottom nav bar
  if (isMobile) {
    return (
      <nav className="mobile-nav">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
          >
            {item.icon}
            <span className="mobile-nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    )
  }

  // Desktop: sidebar
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-top">
        <button className="sidebar-toggle" onClick={onToggle} title={collapsed ? 'Expand' : 'Collapse'}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            {collapsed
              ? <polyline points="9 18 15 12 9 6"/>
              : <polyline points="15 18 9 12 15 6"/>
            }
          </svg>
        </button>
        <div className="sidebar-logo">
          {collapsed ? 'H' : 'Harper'}
        </div>
      </div>

      <div className="sidebar-divider" />

      <nav className="sidebar-nav">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            title={collapsed ? item.label : undefined}
          >
            <span className="sidebar-icon">{item.icon}</span>
            {!collapsed && <span className="sidebar-label">{item.sidebarLabel || item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User indicator at bottom */}
      <div className="sidebar-user">
        <span className={`avatar ${currentUser === 'natalie' ? 'natalie' : 'grace'}`}>
          {currentUser ? currentUser[0].toUpperCase() : '?'}
        </span>
        {!collapsed && (
          <span className="sidebar-user-name">
            {currentUser ? currentUser.charAt(0).toUpperCase() + currentUser.slice(1) : ''}
          </span>
        )}
      </div>
    </aside>
  )
}
