import { useState, useCallback } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays,
  format, isSameMonth, isSameDay, isToday, isWeekend, parseISO,
  eachDayOfInterval,
} from 'date-fns'
import { supabase } from '../lib/supabase'
import { useMonth } from '../hooks/useMonth'
import { useRealtime } from '../hooks/useRealtime'
import MonthSelector from '../components/MonthSelector'
import PostPill from '../components/PostPill'
import Modal from '../components/Modal'
import './CalendarPage.css'

const PLATFORMS = ['instagram', 'tiktok', 'email', 'other']
const CONTENT_TYPES = {
  instagram: ['Post', 'Reel', 'Story', 'Carousel'],
  tiktok: ['Video', 'Duet'],
  email: ['Campaign', 'Newsletter'],
  other: ['Post'],
}
const STATUSES = ['draft', 'scheduled', 'posted']
const ASSIGNEES = ['natalie', 'grace']

export default function CalendarPage() {
  const { currentMonth } = useMonth()
  const currentUser = localStorage.getItem('harper-user') || 'natalie'
  const otherUser = currentUser === 'natalie' ? 'grace' : 'natalie'

  const [viewMode, setViewMode] = useState('month') // month | week
  const [calendarView, setCalendarView] = useState('master') // mine | theirs | master
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedPost, setSelectedPost] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [mobileDay, setMobileDay] = useState(null)
  const [isMobile] = useState(() => window.innerWidth < 768)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)

  const fetchPosts = useCallback(() =>
    supabase
      .from('calendar_posts')
      .select('*')
      .gte('date', format(calendarStart, 'yyyy-MM-dd'))
      .lte('date', format(calendarEnd, 'yyyy-MM-dd'))
      .order('date'),
    [format(calendarStart, 'yyyy-MM-dd'), format(calendarEnd, 'yyyy-MM-dd')]
  )

  const fetchPromos = useCallback(() =>
    supabase
      .from('promotions')
      .select('*')
      .lte('start_date', format(calendarEnd, 'yyyy-MM-dd'))
      .gte('end_date', format(calendarStart, 'yyyy-MM-dd')),
    [format(calendarStart, 'yyyy-MM-dd'), format(calendarEnd, 'yyyy-MM-dd')]
  )

  const { data: posts, setData: setPosts } = useRealtime('calendar_posts', fetchPosts, [format(currentMonth, 'yyyy-MM')])
  const { data: promotions } = useRealtime('promotions', fetchPromos, [format(currentMonth, 'yyyy-MM')])

  // Filter posts by view
  const filteredPosts = posts.filter(p => {
    if (calendarView === 'mine') return p.assigned_to === currentUser
    if (calendarView === 'theirs') return p.assigned_to === otherUser
    return true
  })

  const days = []
  let day = calendarStart
  while (day <= calendarEnd) {
    days.push(day)
    day = addDays(day, 1)
  }

  const getPostsForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return filteredPosts.filter(p => p.date === dateStr)
  }

  const getPromosForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return promotions.filter(p => p.start_date <= dateStr && p.end_date >= dateStr)
  }

  const isPromoStart = (promo, date) => promo.start_date === format(date, 'yyyy-MM-dd')

  const handleDayClick = (date) => {
    if (isMobile) {
      setMobileDay(date)
      return
    }
    setSelectedDate(format(date, 'yyyy-MM-dd'))
    setSelectedPost(null)
    setShowModal(true)
  }

  const handlePostClick = (post, e) => {
    if (e) e.stopPropagation()
    setSelectedPost(post)
    setSelectedDate(post.date)
    setShowModal(true)
  }

  const handleMobileAdd = () => {
    if (mobileDay) {
      setSelectedDate(format(mobileDay, 'yyyy-MM-dd'))
      setSelectedPost(null)
      setShowModal(true)
    }
  }

  return (
    <div className="calendar-page">
      <div className="page-header">
        <h1 className="page-title">Calendar</h1>
        <div className="calendar-controls">
          {/* View: Mine / Other / Master */}
          <div className="view-toggle">
            <button className={calendarView === 'mine' ? 'active' : ''} onClick={() => setCalendarView('mine')}>
              Mine
            </button>
            <button className={calendarView === 'theirs' ? 'active' : ''} onClick={() => setCalendarView('theirs')}>
              {otherUser.charAt(0).toUpperCase() + otherUser.slice(1)}
            </button>
            <button className={calendarView === 'master' ? 'active' : ''} onClick={() => setCalendarView('master')}>
              Master
            </button>
          </div>
          {/* Month / Week */}
          <div className="view-toggle">
            <button className={viewMode === 'month' ? 'active' : ''} onClick={() => setViewMode('month')}>Month</button>
            <button className={viewMode === 'week' ? 'active' : ''} onClick={() => setViewMode('week')}>Week</button>
          </div>
        </div>
      </div>

      <div className="page-container">
        <MonthSelector />

        {viewMode === 'month' ? (
          <MonthGrid
            days={days}
            currentMonth={currentMonth}
            calendarView={calendarView}
            currentUser={currentUser}
            getPostsForDate={getPostsForDate}
            getPromosForDate={getPromosForDate}
            isPromoStart={isPromoStart}
            onDayClick={handleDayClick}
            onPostClick={handlePostClick}
          />
        ) : (
          <WeekView
            currentMonth={currentMonth}
            posts={filteredPosts}
            calendarView={calendarView}
            currentUser={currentUser}
            onPostClick={handlePostClick}
            onDayClick={handleDayClick}
          />
        )}
      </div>

      {/* Mobile day slide-up */}
      {mobileDay && (
        <MobileDayPanel
          date={mobileDay}
          posts={getPostsForDate(mobileDay)}
          calendarView={calendarView}
          currentUser={currentUser}
          onClose={() => setMobileDay(null)}
          onPostClick={handlePostClick}
          onAdd={handleMobileAdd}
        />
      )}

      {/* Mobile FAB */}
      {isMobile && !mobileDay && (
        <button className="mobile-fab" onClick={() => {
          setSelectedDate(format(new Date(), 'yyyy-MM-dd'))
          setSelectedPost(null)
          setShowModal(true)
        }}>+</button>
      )}

      {showModal && (
        <PostModal
          date={selectedDate}
          post={selectedPost}
          currentUser={currentUser}
          setPosts={setPosts}
          onClose={() => { setShowModal(false); setSelectedPost(null); setMobileDay(null) }}
        />
      )}
    </div>
  )
}

function MonthGrid({ days, currentMonth, calendarView, currentUser, getPostsForDate, getPromosForDate, isPromoStart, onDayClick, onPostClick }) {
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="calendar-grid">
      {weekDays.map(d => (
        <div key={d} className="calendar-header-cell">{d}</div>
      ))}
      {days.map(day => {
        const dayPosts = getPostsForDate(day)
        const dayPromos = getPromosForDate(day)
        const isCurrentMonth = isSameMonth(day, currentMonth)
        const todayFlag = isToday(day)
        const weekend = isWeekend(day)

        return (
          <div
            key={day.toString()}
            className={`calendar-cell
              ${!isCurrentMonth ? 'other-month' : ''}
              ${todayFlag ? 'today' : ''}
              ${weekend && isCurrentMonth ? 'weekend' : ''}`}
            onClick={() => onDayClick(day)}
          >
            <span className={`day-number ${todayFlag ? 'today-number' : ''}`}>
              {format(day, 'd')}
            </span>

            <div className="cell-promos">
              {dayPromos.map(promo => (
                isPromoStart(promo, day) ? (
                  <div key={promo.id} className="promo-banner"
                    style={{ background: promo.color || '#F4A7B9' }}
                    onClick={(e) => e.stopPropagation()} title={promo.name}>
                    {promo.name}
                  </div>
                ) : (
                  <div key={promo.id} className="promo-banner-continue"
                    style={{ background: promo.color || '#F4A7B9' }} />
                )
              ))}
            </div>

            <div className="cell-posts">
              {dayPosts.map(post => (
                <PostPill
                  key={post.id}
                  post={post}
                  showAssignee={calendarView === 'master'}
                  currentUser={currentUser}
                  onClick={(e) => onPostClick(post, e)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function WeekView({ currentMonth, posts, calendarView, currentUser, onPostClick, onDayClick }) {
  const weekStart = startOfWeek(currentMonth)
  const weekEnd = endOfWeek(currentMonth)
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const hours = Array.from({ length: 12 }, (_, i) => i + 9)

  return (
    <div className="week-view">
      <div className="week-header">
        <div className="week-time-col" />
        {weekDays.map(day => (
          <div key={day.toString()} className="week-day-header">
            <span className="week-day-name">{format(day, 'EEE')}</span>
            <span className={`week-day-number ${isToday(day) ? 'today-number' : ''}`}>
              {format(day, 'd')}
            </span>
          </div>
        ))}
      </div>
      <div className="week-body">
        {hours.map(hour => (
          <div key={hour} className="week-row">
            <div className="week-time-label">{hour > 12 ? `${hour - 12}pm` : hour === 12 ? '12pm' : `${hour}am`}</div>
            {weekDays.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const dayPosts = posts.filter(p => p.date === dateStr)
              return (
                <div key={day.toString()} className="week-cell" onClick={() => onDayClick(day)}>
                  {hour === 9 && dayPosts.map(post => (
                    <PostPill key={post.id} post={post}
                      showAssignee={calendarView === 'master'}
                      currentUser={currentUser}
                      onClick={(e) => onPostClick(post, e)} />
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function MobileDayPanel({ date, posts, calendarView, currentUser, onClose, onPostClick, onAdd }) {
  return (
    <div className="mobile-day-overlay" onClick={onClose}>
      <div className="mobile-day-panel" onClick={e => e.stopPropagation()}>
        <div className="mobile-day-header">
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 300 }}>
            {format(date, 'EEEE, MMMM d')}
          </h3>
          <button onClick={onClose} style={{ fontSize: 20, color: 'var(--ink-light)' }}>x</button>
        </div>
        <div className="mobile-day-posts">
          {posts.length === 0 && <p className="caption" style={{ padding: 16 }}>No posts for this day</p>}
          {posts.map(post => (
            <PostPill key={post.id} post={post}
              showAssignee={calendarView === 'master'}
              currentUser={currentUser}
              onClick={(e) => onPostClick(post, e)} />
          ))}
        </div>
        <button className="btn-save" onClick={onAdd} style={{ margin: 16 }}>+ Add Post</button>
      </div>
    </div>
  )
}

function PostModal({ date, post, currentUser, setPosts, onClose }) {
  const [form, setForm] = useState({
    platform: post?.platform || 'instagram',
    content_type: post?.content_type || 'Post',
    caption: post?.caption || '',
    status: post?.status || 'draft',
    assigned_to: post?.assigned_to || currentUser || 'natalie',
  })
  const [saving, setSaving] = useState(false)

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { ...form, date, updated_at: new Date().toISOString() }
      if (post) {
        const { data, error } = await supabase.from('calendar_posts').update(payload).eq('id', post.id).select()
        if (!error && data?.[0]) {
          setPosts(prev => prev.map(p => p.id === post.id ? data[0] : p))
        }
      } else {
        const { data, error } = await supabase.from('calendar_posts').insert([payload]).select()
        if (!error && data?.[0]) {
          setPosts(prev => {
            if (prev.find(p => p.id === data[0].id)) return prev
            return [...prev, data[0]]
          })
        }
      }
      onClose()
    } catch (err) {
      console.error('Error saving post:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!post) return
    const { error } = await supabase.from('calendar_posts').delete().eq('id', post.id)
    if (!error) {
      setPosts(prev => prev.filter(p => p.id !== post.id))
    }
    onClose()
  }

  const contentTypes = CONTENT_TYPES[form.platform] || ['Post']

  return (
    <Modal onClose={onClose}>
      <div style={{ padding: '32px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 24, fontWeight: 300, marginBottom: 24 }}>
          {post ? 'Edit Post' : 'New Post'}
        </h2>
        {date && <p className="caption" style={{ marginBottom: 20 }}>{format(parseISO(date), 'EEEE, MMMM d, yyyy')}</p>}

        <div className="form-group">
          <label className="form-label">Platform</label>
          <div className="pill-group">
            {PLATFORMS.map(p => (
              <button key={p} className={`pill ${form.platform === p ? 'active' : ''}`}
                onClick={() => { update('platform', p); update('content_type', CONTENT_TYPES[p]?.[0] || 'Post') }}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Content Type</label>
          <div className="pill-group">
            {contentTypes.map(t => (
              <button key={t} className={`pill ${form.content_type === t ? 'active' : ''}`}
                onClick={() => update('content_type', t)}>{t}</button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Caption / Copy</label>
          <textarea rows={4} value={form.caption} onChange={(e) => update('caption', e.target.value)}
            placeholder="Write your caption..." style={{ width: '100%' }} />
        </div>

        <div className="form-group">
          <label className="form-label">Status</label>
          <div className="pill-group">
            {STATUSES.map(s => (
              <button key={s} className={`pill ${form.status === s ? 'active' : ''}`}
                onClick={() => update('status', s)}>{s}</button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Assigned to</label>
          <div className="pill-group">
            {ASSIGNEES.map(a => (
              <button key={a} className={`pill ${form.assigned_to === a ? 'active' : ''}`}
                onClick={() => update('assigned_to', a)}>
                {a.charAt(0).toUpperCase() + a.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <button className="btn-save" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>

        {post && (
          <button style={{ marginTop: 12, color: '#C0392B', display: 'block', textAlign: 'center', width: '100%', fontSize: 12 }}
            onClick={handleDelete}>
            Delete post
          </button>
        )}
      </div>
    </Modal>
  )
}
