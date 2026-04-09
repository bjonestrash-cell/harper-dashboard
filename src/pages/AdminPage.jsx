import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, createChannel } from '../lib/supabase'
import { format } from 'date-fns'
import './AdminPage.css'

const TABLE_LABELS = {
  audit_log: 'Audit Log',
  notes: 'Meeting Notes',
  calendar_posts: 'Calendar Posts',
  tasks: 'Tasks',
  todos: 'To-Dos',
  promotions: 'Promotions',
  daily_notes: 'Daily Notes',
  feed_posts: 'Feed Posts',
  notifications: 'Notifications',
}

const TABLE_COLORS = {
  audit_log: '#1A1412',
  notes: '#C4A8D4',
  calendar_posts: '#F4A7B9',
  tasks: '#B5C4B1',
  todos: '#EDE6DA',
  promotions: '#F4A7B9',
  daily_notes: '#C4A8D4',
  feed_posts: '#EDE6DA',
  notifications: '#B5C4B1',
}

function summarizeRecord(table, record) {
  switch (table) {
    case 'notes':
      return `${record.title || 'Untitled note'} — by ${record.updated_by || '?'}`
    case 'calendar_posts':
      return `${record.platform || '?'} post: "${(record.caption || '').slice(0, 60)}${(record.caption || '').length > 60 ? '...' : ''}"`
    case 'tasks':
      return `${record.title || '?'} — ${record.assigned_to || '?'} — ${record.status || '?'}`
    case 'todos':
      return `${record.title || '?'} — ${record.assigned_to || '?'}`
    case 'promotions':
      return `${record.name || '?'} — ${record.status || '?'}`
    case 'daily_notes':
      return `Note for ${record.date || '?'} by ${record.author || '?'}`
    case 'notifications':
      return `${record.type || 'notification'}: "${(record.message || '').slice(0, 60)}"`
    case 'audit_log':
      return record.summary || `${record.action} on ${record.table_name}`
    default:
      return JSON.stringify(record).slice(0, 80)
  }
}

function getTimestamp(table, record) {
  return record.created_at || record.updated_at || record.date || null
}

export default function AdminPage() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [userFilter, setUserFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const channelRef = useRef(null)

  // Gate: must have admin session
  useEffect(() => {
    if (sessionStorage.getItem('harper-admin') !== 'true') {
      navigate('/', { replace: true })
    }
  }, [navigate])

  // Fetch all data
  useEffect(() => {
    fetchAll()
    // Realtime for all tables
    const watchedTables = ['audit_log', 'notes', 'calendar_posts', 'tasks', 'promotions', 'daily_notes', 'notifications']
    const channel = createChannel('admin-audit')
    watchedTables.forEach(table => {
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table }, (payload) => {
        const record = payload.new
        const entry = {
          ...record,
          _table: table,
          _ts: getTimestamp(table, record),
          _summary: summarizeRecord(table, record),
        }
        setEntries(prev => [entry, ...prev])
      })
      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table }, (payload) => {
        const record = payload.new
        setEntries(prev => prev.map(e =>
          e._table === table && e.id === record.id
            ? { ...record, _table: table, _ts: getTimestamp(table, record), _summary: summarizeRecord(table, record) }
            : e
        ))
      })
      channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, (payload) => {
        const old = payload.old
        if (old?.id) {
          setEntries(prev => prev.filter(e => !(e._table === table && e.id === old.id)))
        }
      })
    })
    channel.subscribe()
    channelRef.current = channel
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    const tables = [
      { name: 'audit_log', query: supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(500) },
      { name: 'notes', query: supabase.from('notes').select('*').order('updated_at', { ascending: false }).limit(200) },
      { name: 'calendar_posts', query: supabase.from('calendar_posts').select('*').order('created_at', { ascending: false }).limit(200) },
      { name: 'tasks', query: supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(200) },
      { name: 'promotions', query: supabase.from('promotions').select('*').order('created_at', { ascending: false }).limit(200) },
      { name: 'daily_notes', query: supabase.from('daily_notes').select('*').order('updated_at', { ascending: false }).limit(200) },
      { name: 'notifications', query: supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(200) },
    ]

    const results = await Promise.all(tables.map(t => t.query))
    const all = []

    results.forEach((res, i) => {
      const tableName = tables[i].name
      if (res.data) {
        res.data.forEach(record => {
          all.push({
            ...record,
            _table: tableName,
            _ts: getTimestamp(tableName, record),
            _summary: summarizeRecord(tableName, record),
          })
        })
      }
    })

    // Sort by timestamp descending
    all.sort((a, b) => {
      const ta = a._ts ? new Date(a._ts).getTime() : 0
      const tb = b._ts ? new Date(b._ts).getTime() : 0
      return tb - ta
    })

    setEntries(all)
    setLoading(false)
  }

  const getUser = (entry) => {
    if (entry._table === 'audit_log') return entry.user_name
    return entry.updated_by || entry.assigned_to || entry.author || entry.from_user || null
  }

  const filtered = entries.filter(e => {
    if (filter !== 'all' && e._table !== filter) return false
    if (userFilter !== 'all') {
      const user = getUser(e)
      if (!user || !user.toLowerCase().includes(userFilter)) return false
    }
    if (search) {
      const s = search.toLowerCase()
      const summary = (e._summary || '').toLowerCase()
      const table = (e._table || '').toLowerCase()
      if (!summary.includes(s) && !table.includes(s)) return false
    }
    return true
  })

  const handleLogout = () => {
    sessionStorage.removeItem('harper-admin')
    navigate('/', { replace: true })
  }

  const formatTs = (ts) => {
    if (!ts) return '—'
    try { return format(new Date(ts), 'MMM d, yyyy h:mm a') } catch { return ts }
  }

  if (sessionStorage.getItem('harper-admin') !== 'true') return null

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-left">
          <h1 className="admin-title">HARPER AUDIT LOG</h1>
          <span className="admin-count">{filtered.length} entries</span>
        </div>
        <div className="admin-header-right">
          <button className="admin-refresh" onClick={fetchAll} title="Refresh">
            {loading ? '...' : '\u21BB'}
          </button>
          <button className="admin-logout" onClick={handleLogout}>Exit</button>
        </div>
      </header>

      <div className="admin-filters">
        <select
          className="admin-select"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        >
          <option value="all">All Tables</option>
          {Object.entries(TABLE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        <select
          className="admin-select"
          value={userFilter}
          onChange={e => setUserFilter(e.target.value)}
        >
          <option value="all">All Users</option>
          <option value="natalie">Natalie</option>
          <option value="grace">Grace</option>
        </select>

        <input
          className="admin-search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search entries..."
        />
      </div>

      <div className="admin-log">
        {loading && entries.length === 0 ? (
          <div className="admin-empty">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="admin-empty">No entries found</div>
        ) : (
          filtered.map((entry, i) => {
            const key = `${entry._table}-${entry.id}-${i}`
            const isExpanded = expandedId === key
            const user = getUser(entry)
            const isAudit = entry._table === 'audit_log'

            return (
              <div
                key={key}
                className={`admin-entry ${isExpanded ? 'expanded' : ''} ${isAudit ? 'audit-entry' : ''}`}
                onClick={() => setExpandedId(isExpanded ? null : key)}
              >
                <div className="admin-entry-row">
                  <span
                    className="admin-entry-table"
                    style={{ backgroundColor: TABLE_COLORS[entry._table] || '#EDE6DA' }}
                  >
                    {isAudit ? entry.action?.toUpperCase() : entry._table?.replace('_', ' ')}
                  </span>
                  {isAudit && (
                    <span className="admin-entry-subtable">
                      {TABLE_LABELS[entry.table_name] || entry.table_name}
                    </span>
                  )}
                  <span className="admin-entry-summary">
                    {isAudit ? entry.summary : entry._summary}
                  </span>
                  <span className="admin-entry-meta">
                    {user && <span className={`admin-entry-user ${user}`}>{user}</span>}
                    <span className="admin-entry-time">{formatTs(entry._ts)}</span>
                  </span>
                </div>

                {isExpanded && (
                  <pre className="admin-entry-details">
                    {JSON.stringify(
                      isAudit && entry.details ? entry.details : entry,
                      null, 2
                    )}
                  </pre>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
