import { NavLink } from 'react-router-dom'
import './Sidebar.css'

const navItems = [
  { path: '/calendar', label: 'Calendar' },
  { path: '/promotions', label: 'Promotions' },
  { path: '/tasks', label: 'Tasks' },
  { path: '/notes', label: 'Notes' },
]

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">Harper</div>
      <div className="sidebar-divider" />
      <nav className="sidebar-nav">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">harper in the horizon</div>
    </aside>
  )
}
