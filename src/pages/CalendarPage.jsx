import { useState, useCallback, useEffect, useRef } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks,
  format, isSameMonth, isSameDay, isToday, isWeekend, parseISO,
  eachDayOfInterval,
} from 'date-fns'
import { supabase } from '../lib/supabase'
import { useMonth } from '../hooks/useMonth'
import { useRealtime } from '../hooks/useRealtime'
import PageHeader from '../components/PageHeader'
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

const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : ''

export default function CalendarPage() {
  const { currentMonth } = useMonth()
  const currentUser = localStorage.getItem('harper-user') || 'natalie'
  const otherUser = currentUser === 'natalie' ? 'grace' : 'natalie'

  const [viewMode, setViewMode] = useState('month')
  const [calendarView, setCalendarView] = useState('master')
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedPost, setSelectedPost] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [mobileDay, setMobileDay] = useState(null)
  const [selectedDay, setSelectedDay] = useState(null)
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
    setSelectedDay(date)
  }

  const handlePostClick = (post, e) => {
    if (e) e.stopPropagation()
    setSelectedPost(post)
    setSelectedDate(post.date)
    setShowModal(true)
  }

  const openAddModal = (date) => {
    const d = date || selectedDay || new Date()
    setSelectedDate(format(d, 'yyyy-MM-dd'))
    setSelectedPost(null)
    setShowModal(true)
  }

  const handleMobileAdd = () => {
    if (mobileDay) {
      setSelectedDate(format(mobileDay, 'yyyy-MM-dd'))
      setSelectedPost(null)
      setShowModal(true)
    }
  }

  const deletePost = async (id) => {
    const { error } = await supabase.from('calendar_posts').delete().eq('id', id)
    if (!error) setPosts(prev => prev.filter(p => p.id !== id))
  }

  const selectedDayPosts = selectedDay ? getPostsForDate(selectedDay) : []

  return (
    <div className="calendar-page">
      <PageHeader title="Calendar">
        <div className="view-toggle">
          <button className={calendarView === 'mine' ? 'active' : ''} onClick={() => setCalendarView('mine')}>
            {capitalize(currentUser)}
          </button>
          <button className={calendarView === 'theirs' ? 'active' : ''} onClick={() => setCalendarView('theirs')}>
            {capitalize(otherUser)}
          </button>
          <button className={calendarView === 'master' ? 'active' : ''} onClick={() => setCalendarView('master')}>
            Master
          </button>
        </div>
        <div className="view-toggle">
          <button className={viewMode === 'month' ? 'active' : ''} onClick={() => setViewMode('month')}>Month</button>
          <button className={viewMode === 'week' ? 'active' : ''} onClick={() => setViewMode('week')}>Week</button>
        </div>
      </PageHeader>

      <div className="page-container">
        <MonthSelector mode={viewMode} />

        {/* Color legend */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 20 }}>
          {[{l:'Post',c:'#F2A7B0'},{l:'Meeting',c:'#A8C4D4'},{l:'Holiday',c:'#D4B896'},{l:'Other',c:'#B5C4B1'}].map(i => (
            <div key={i.l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: i.c, flexShrink: 0 }} />
              <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--ink-light)' }}>{i.l}</span>
            </div>
          ))}
        </div>

        {viewMode === 'month' ? (
          <MonthGrid
            days={days}
            currentMonth={currentMonth}
            calendarView={calendarView}
            currentUser={currentUser}
            selectedDay={selectedDay}
            getPostsForDate={getPostsForDate}
            getPromosForDate={getPromosForDate}
            isPromoStart={isPromoStart}
            onDayClick={handleDayClick}
            onDayDoubleClick={openAddModal}
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

        {/* Mobile weekly event strip */}
        {isMobile && viewMode === 'month' && <WeeklyStrip posts={filteredPosts} />}

        {/* Desktop day detail modal */}
        {selectedDay && !isMobile && (
          <DesktopDayModal
            date={selectedDay}
            posts={selectedDayPosts}
            currentUser={currentUser}
            onClose={() => setSelectedDay(null)}
            onPostClick={handlePostClick}
            onAddPost={() => openAddModal(selectedDay)}
            onDeletePost={deletePost}
          />
        )}

        {/* Recent Meeting Notes */}
        <RecentMeetingNotes />
      </div>

      {/* Mobile day slide-up */}
      {mobileDay && (
        <MobileDayPanel date={mobileDay} posts={getPostsForDate(mobileDay)} calendarView={calendarView}
          currentUser={currentUser} onClose={() => setMobileDay(null)} onPostClick={handlePostClick} onAdd={handleMobileAdd} />
      )}

      {/* Floating Add Post button */}
      <button className="fab-add-post" onClick={() => openAddModal(selectedDay || new Date())}>+</button>

      {showModal && (
        <PostModal date={selectedDate} post={selectedPost} currentUser={currentUser} setPosts={setPosts}
          onClose={() => { setShowModal(false); setSelectedPost(null); setMobileDay(null) }} />
      )}
    </div>
  )
}

/* ─── Daily Note Column ─── */
function DailyNoteColumn({ date, author, label, accentColor, currentUser }) {
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [noteId, setNoteId] = useState(null)
  const saveTimer = useRef(null)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('daily_notes')
        .select('*')
        .eq('date', format(date, 'yyyy-MM-dd'))
        .eq('author', author)
        .single()
      if (data) {
        setContent(data.content || '')
        setNoteId(data.id)
      } else {
        setContent('')
        setNoteId(null)
      }
    }
    load()
  }, [date, author])

  // Real-time subscription
  useEffect(() => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const channel = supabase
      .channel(`daily-notes-${dateStr}-${author}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'daily_notes' },
        (payload) => {
          if (payload.new && payload.new.date === dateStr && payload.new.author === author) {
            setContent(payload.new.content || '')
            setNoteId(payload.new.id)
          }
        }
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [date, author])

  const handleChange = (val) => {
    setContent(val)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      const dateStr = format(date, 'yyyy-MM-dd')
      if (noteId) {
        await supabase.from('daily_notes').update({ content: val, updated_at: new Date().toISOString() }).eq('id', noteId)
      } else {
        const { data } = await supabase.from('daily_notes').insert([{ date: dateStr, author, content: val }]).select().single()
        if (data) setNoteId(data.id)
      }
      setSaving(false)
    }, 1500)
  }

  const canEdit = author === 'shared' || author === currentUser

  return (
    <div style={{ backgroundColor: 'var(--white)', border: '1px solid var(--cream-deep)', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 10, borderBottom: `2px solid ${accentColor}` }}>
        <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: 2.5, textTransform: 'uppercase', color: 'var(--ink)' }}>{label}</span>
        {saving && <span style={{ fontSize: 9, color: 'var(--ink-light)', letterSpacing: 1 }}>saving...</span>}
      </div>
      <textarea
        value={content}
        onChange={e => handleChange(e.target.value)}
        readOnly={!canEdit}
        placeholder={canEdit ? `${label}'s notes for this day...` : 'No notes yet.'}
        style={{
          width: '100%', minHeight: 120, border: 'none', outline: 'none', resize: 'none',
          fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 300, lineHeight: 1.7,
          color: 'var(--ink)', backgroundColor: 'transparent',
          cursor: canEdit ? 'text' : 'default', opacity: canEdit ? 1 : 0.6,
        }}
      />
    </div>
  )
}

/* ─── Month Grid ─── */
function MonthGrid({ days, currentMonth, calendarView, currentUser, selectedDay, getPostsForDate, getPromosForDate, isPromoStart, onDayClick, onDayDoubleClick, onPostClick }) {
  const isMobileGrid = window.innerWidth < 768
  const weekDays = isMobileGrid ? ['S','M','T','W','T','F','S'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="calendar-grid">
      {weekDays.map((d, i) => (
        <div key={i} className="calendar-header-cell">{d}</div>
      ))}
      {days.map(day => {
        const dayPosts = getPostsForDate(day)
        const dayPromos = getPromosForDate(day)
        const isCurrentMonth = isSameMonth(day, currentMonth)
        const todayFlag = isToday(day)
        const weekend = isWeekend(day)
        const isSelected = selectedDay && isSameDay(day, selectedDay)

        return (
          <div
            key={day.toString()}
            className={`calendar-cell
              ${!isCurrentMonth ? 'other-month' : ''}
              ${todayFlag ? 'today' : ''}
              ${weekend && isCurrentMonth ? 'weekend' : ''}
              ${isSelected ? 'selected' : ''}`}
            onClick={() => onDayClick(day)}
            onDoubleClick={(e) => { e.stopPropagation(); onDayDoubleClick(day) }}
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
                <PostPill key={post.id} post={post} showAssignee={calendarView === 'master'}
                  currentUser={currentUser} onClick={(e) => onPostClick(post, e)} />
              ))}
            </div>
            {isMobileGrid && dayPosts.length > 0 && (
              <div className="mobile-cell-label">
                <span className="mobile-cell-title">{dayPosts[0].caption || dayPosts[0].content_type || 'Event'}</span>
                {dayPosts.length > 1 && <span className="mobile-cell-more">+{dayPosts.length - 1}</span>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── Week View ─── */
function WeekView({ currentMonth, posts, calendarView, currentUser, onPostClick, onDayClick }) {
  const weekStart = startOfWeek(currentMonth)
  const weekEnd = endOfWeek(currentMonth)
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const isMobileView = window.innerWidth < 768

  // Mobile: day-strip + event list
  if (isMobileView) return <MobileWeekView weekDays={weekDays} posts={posts} calendarView={calendarView} currentUser={currentUser} onPostClick={onPostClick} />

  // Desktop: column-based day layout
  const dotColors = { post: '#F2A7B0', meeting: '#A8C4D4', holiday: '#D4B896', other: '#B5C4B1' }
  const getEvType = (p) => {
    if (p.platform === 'meeting' || p.content_type === 'meeting') return 'meeting'
    if (p.platform === 'holiday' || p.content_type === 'holiday') return 'holiday'
    if (p.platform === 'other-event' || p.content_type === 'other') return 'other'
    return 'post'
  }

  return (
    <div className="dwv-grid">
      {weekDays.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const dayPosts = posts.filter(p => p.date === dateStr)
        const todayFlag = isToday(day)

        return (
          <div key={day.toString()} className={`dwv-column ${todayFlag ? 'dwv-today' : ''}`}>
            <div className="dwv-col-header">
              <span className="dwv-col-day">{format(day, 'EEE')}</span>
              <span className={`dwv-col-num ${todayFlag ? 'today-number' : ''}`}>{format(day, 'd')}</span>
            </div>
            <div className="dwv-col-events">
              {dayPosts.length === 0 && (
                <span className="dwv-empty">&mdash;</span>
              )}
              {dayPosts.map(post => {
                const evType = getEvType(post)
                return (
                  <div key={post.id} className="dwv-event-card"
                    style={{ borderLeftColor: dotColors[evType] }}
                    onClick={(e) => onPostClick(post, e)}>
                    <span className="dwv-event-title">{post.caption || post.content_type || evType}</span>
                    {getMeetingTime(post) && <span style={{ fontSize: 9, color: 'var(--ink-light)', display: 'block' }}>{formatTime12(getMeetingTime(post))}</span>}
                    <span className="dwv-event-type" style={{ color: dotColors[evType] }}>{evType}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Mobile Week View ─── */
function MobileWeekView({ weekDays, posts, calendarView, currentUser, onPostClick }) {
  const todayInWeek = weekDays.find(d => isToday(d))
  const [selectedDay, setSelectedDay] = useState(null)
  const dotColors = { post: '#F2A7B0', meeting: '#A8C4D4', holiday: '#D4B896', other: '#B5C4B1' }
  const getEvType = (p) => {
    if (p.platform === 'meeting' || p.content_type === 'meeting') return 'meeting'
    if (p.platform === 'holiday' || p.content_type === 'holiday') return 'holiday'
    if (p.platform === 'other-event' || p.content_type === 'other') return 'other'
    return 'post'
  }

  // Reset selection when week changes
  const weekKey = weekDays[0]?.toString()
  useEffect(() => { setSelectedDay(null) }, [weekKey])

  const handleDayTap = (day) => {
    if (selectedDay && isSameDay(day, selectedDay)) {
      setSelectedDay(null) // deselect → back to full week
    } else {
      setSelectedDay(day)
    }
  }

  // Events: filtered to one day or full week
  const weekEvents = posts.filter(p => {
    const startStr = format(weekDays[0], 'yyyy-MM-dd')
    const endStr = format(weekDays[6], 'yyyy-MM-dd')
    return p.date >= startStr && p.date <= endStr
  }).sort((a, b) => a.date.localeCompare(b.date))

  const displayEvents = selectedDay
    ? weekEvents.filter(p => p.date === format(selectedDay, 'yyyy-MM-dd'))
    : weekEvents

  // Group by day for full week view
  const groupedByDay = {}
  displayEvents.forEach(p => {
    if (!groupedByDay[p.date]) groupedByDay[p.date] = []
    groupedByDay[p.date].push(p)
  })

  const renderEventRow = (post) => {
    const evType = getEvType(post)
    return (
      <div key={post.id} className="mwv-event-row" onClick={(e) => onPostClick(post, e)}>
        <span className="mwv-event-dot" style={{ backgroundColor: dotColors[evType] }} />
        <div className="mwv-event-body">
          <span className="mwv-event-title">{post.caption || post.content_type || evType}</span>
          {getMeetingTime(post) && <span style={{ fontSize: 10, color: 'var(--ink-light)', display: 'block', marginTop: 2 }}>{formatTime12(getMeetingTime(post))}</span>}
          <div className="mwv-event-meta">
            <span className="mwv-event-type" style={{ color: dotColors[evType] }}>{evType}</span>
            {post.assigned_to && <span className="mwv-event-creator">{post.assigned_to}</span>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mobile-week-view">
      {/* Day strip */}
      <div className="mwv-day-strip">
        {weekDays.map(day => {
          const isActive = selectedDay && isSameDay(day, selectedDay)
          const todayMark = isToday(day)
          const hasEvents = posts.some(p => p.date === format(day, 'yyyy-MM-dd'))
          return (
            <button key={day.toString()} className={`mwv-day ${isActive ? 'active' : ''}`} onClick={() => handleDayTap(day)}>
              <span className="mwv-day-letter">{format(day, 'EEEEE')}</span>
              <span className={`mwv-day-num ${todayMark && !isActive ? 'today-ring' : ''}`}>{format(day, 'd')}</span>
              {hasEvents && <span className="mwv-day-dot" />}
            </button>
          )
        })}
      </div>

      {/* Event list */}
      <div className="mwv-events">
        {selectedDay && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="mwv-date-label">{format(selectedDay, 'EEEE, MMMM d')}</div>
            <span onClick={() => setSelectedDay(null)} style={{
              fontSize: 10, fontWeight: 400, color: 'var(--ink-light)', letterSpacing: 0.5,
              cursor: 'pointer', padding: '4px 0',
            }}>View all</span>
          </div>
        )}

        {displayEvents.length === 0 && (
          <p className="mwv-empty">{selectedDay ? 'Nothing scheduled' : 'No events this week'}</p>
        )}

        {selectedDay ? (
          displayEvents.map(renderEventRow)
        ) : (
          Object.entries(groupedByDay).map(([dateStr, events]) => (
            <div key={dateStr}>
              <div className="mwv-group-header">{format(parseISO(dateStr), 'EEE d').toUpperCase()}</div>
              {events.map(renderEventRow)}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/* ─── Desktop Day Modal ─── */
function DesktopDayModal({ date, posts, currentUser, onClose, onPostClick, onAddPost, onDeletePost }) {
  const dotColors = { post: '#F2A7B0', meeting: '#A8C4D4', holiday: '#D4B896', other: '#B5C4B1' }
  const getEvType = (p) => {
    if (p.platform === 'meeting' || p.content_type === 'meeting') return 'meeting'
    if (p.platform === 'holiday' || p.content_type === 'holiday') return 'holiday'
    if (p.platform === 'other-event' || p.content_type === 'other') return 'other'
    return 'post'
  }

  return (
    <div className="desktop-day-overlay" onClick={onClose}>
      <div className="desktop-day-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="ddm-header">
          <span className="ddm-date">{format(date, 'EEEE, MMMM d, yyyy')}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={onAddPost} className="ddm-add-btn">+</button>
            <button onClick={onClose} className="ddm-close">&times;</button>
          </div>
        </div>

        {/* Events */}
        <div className="ddm-events">
          {posts.length === 0 && (
            <p className="ddm-empty">Nothing scheduled for this day.</p>
          )}
          {posts.map(post => {
            const evType = getEvType(post)
            return (
              <div key={post.id} className="ddm-event-row" onClick={(e) => onPostClick(post, e)}>
                <span className="ddm-dot" style={{ backgroundColor: dotColors[evType] }} />
                <div className="ddm-event-body">
                  <span className="ddm-event-title">{post.caption || post.content_type || evType}</span>
                  {getMeetingTime(post) && <span className="ddm-event-time">{formatTime12(getMeetingTime(post))}</span>}
                  <div className="ddm-event-meta">
                    <span className="ddm-event-type" style={{ color: dotColors[evType] }}>{evType}</span>
                    {post.assigned_to && (
                      <span className="ddm-event-creator" style={{ color: post.assigned_to === 'natalie' ? '#D4849A' : 'var(--ink-light)' }}>
                        {post.assigned_to}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onDeletePost(post.id) }} className="ddm-delete">&times;</button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ─── Mobile Day Panel ─── */
function MobileDayPanel({ date, posts, calendarView, currentUser, onClose, onPostClick, onAdd }) {
  const [closing, setClosing] = useState(false)
  const getEvType = (p) => {
    if (p.platform === 'meeting' || p.content_type === 'meeting') return 'meeting'
    if (p.platform === 'holiday' || p.content_type === 'holiday') return 'holiday'
    if (p.platform === 'other-event' || p.content_type === 'other') return 'other'
    return 'post'
  }
  const dotColors = { post: '#F2A7B0', meeting: '#A8C4D4', holiday: '#D4B896', other: '#B5C4B1' }

  const handleClose = () => {
    setClosing(true)
    setTimeout(onClose, 250)
  }

  return (
    <div className={`mobile-day-overlay ${closing ? 'closing' : ''}`} onClick={handleClose}>
      <div className={`mobile-day-panel ${closing ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="mobile-day-header">
          <h3 style={{ fontSize: 11, fontWeight: 500, letterSpacing: 4, textTransform: 'uppercase', color: 'var(--ink-light)' }}>
            {format(date, 'EEEE, MMMM d')}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={onAdd} style={{
              width: 32, height: 32, borderRadius: '50%', backgroundColor: 'var(--ink)',
              color: 'var(--cream)', border: 'none', fontSize: 20, fontWeight: 200,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', lineHeight: 1,
            }}>+</button>
            <button className="mobile-day-close" onClick={handleClose}>&times;</button>
          </div>
        </div>
        <div className="mobile-day-posts">
          {posts.length === 0 && (
            <p style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, fontWeight: 300, color: 'var(--ink-light)' }}>
              Nothing scheduled
            </p>
          )}
          {posts.map(post => {
            const evType = getEvType(post)
            return (
              <div key={post.id} onClick={(e) => onPostClick(post, e)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 0', borderBottom: '1px solid var(--cream-deep)', cursor: 'pointer' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: dotColors[evType], flexShrink: 0, marginTop: 3 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 400, color: 'var(--ink)', lineHeight: 1.5 }}>
                    {post.caption || post.content_type || evType}
                  </div>
                  {getMeetingTime(post) && <div style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 2 }}>{formatTime12(getMeetingTime(post))}</div>}
                  <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                    <span style={{
                      fontSize: 9, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase',
                      color: dotColors[evType], backgroundColor: 'var(--white)',
                      padding: '2px 8px', borderRadius: 9999,
                    }}>
                      {evType}
                    </span>
                    {post.assigned_to && (
                      <span style={{
                        fontSize: 9, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase',
                        color: post.assigned_to === 'natalie' ? '#D4849A' : 'var(--ink-light)',
                      }}>
                        {post.assigned_to}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ padding: '40px 20px 24px', textAlign: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 300, color: 'var(--ink-light)', letterSpacing: 1, opacity: 0.5 }}>powered by forme</span>
        </div>
      </div>
    </div>
  )
}

/* ─── Mobile Weekly Event Strip ─── */
function WeeklyStrip({ posts }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const currentWeekStart = startOfWeek(addWeeks(new Date(), weekOffset))
  const currentWeekEnd = endOfWeek(currentWeekStart)
  const weekDays = eachDayOfInterval({ start: currentWeekStart, end: currentWeekEnd })

  const dotColors = { post: '#F2A7B0', meeting: '#A8C4D4', holiday: '#D4B896', other: '#B5C4B1' }
  const getEvType = (p) => {
    if (p.platform === 'meeting' || p.content_type === 'meeting') return 'meeting'
    if (p.platform === 'holiday' || p.content_type === 'holiday') return 'holiday'
    if (p.platform === 'other-event' || p.content_type === 'other') return 'other'
    return 'post'
  }

  const weekEvents = posts.filter(p => {
    const d = p.date
    return d >= format(currentWeekStart, 'yyyy-MM-dd') && d <= format(currentWeekEnd, 'yyyy-MM-dd')
  }).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="weekly-strip">
      <div className="weekly-strip-header">
        <button onClick={() => setWeekOffset(prev => prev - 1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-light)', padding: '4px 8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ink-light)' }}>
          {format(currentWeekStart, 'MMM d')} – {format(currentWeekEnd, 'MMM d')}
        </span>
        <button onClick={() => setWeekOffset(prev => prev + 1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-light)', padding: '4px 8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
      <div className="weekly-strip-events">
        {weekEvents.length === 0 && (
          <p style={{ fontSize: 12, fontWeight: 300, color: 'var(--ink-light)', padding: '12px 0', textAlign: 'center' }}>
            No events this week
          </p>
        )}
        {weekEvents.map(ev => {
          const evType = getEvType(ev)
          return (
            <div key={ev.id} className="weekly-strip-event">
              <span className="weekly-strip-date">{format(parseISO(ev.date), 'EEE d')}</span>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: dotColors[evType], flexShrink: 0 }} />
              <span className="weekly-strip-title">{ev.caption || ev.content_type || evType}</span>
              <span className="weekly-strip-type">{evType}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Event Type Colors ─── */
const EVENT_COLORS = { post: '#F2A7B0', meeting: '#A8C4D4', holiday: '#D4B896', other: '#B5C4B1' }

function getMeetingTime(post) {
  if (post.time) return post.time
  if ((post.platform === 'meeting' || post.content_type === 'meeting') && post.status?.includes('|')) {
    const t = post.status.split('|')[0]
    if (t.includes(':')) return t
  }
  return null
}

function formatTime12(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}
const EVENT_TYPES = ['post', 'meeting', 'holiday', 'other']

/* ─── Inline Modal Date Picker ─── */
function ModalDatePicker({ date, onChange }) {
  const [open, setOpen] = useState(false)
  const selected = date ? parseISO(date) : new Date()
  const [viewMonth, setViewMonth] = useState(selected)

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewMonth)),
    end: endOfWeek(endOfMonth(viewMonth)),
  })

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
        padding: '0 0 20px', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
      }}>
        <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--ink)', letterSpacing: 0.3 }}>
          {format(selected, 'EEEE, MMMM d, yyyy')}
        </span>
        <span style={{ fontSize: 10, color: 'var(--ink-light)', marginLeft: 4 }}>change</span>
      </button>
    )
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <button onClick={() => setOpen(false)} style={{
        display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
        padding: '0 0 12px', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
      }}>
        <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--ink)', letterSpacing: 0.3 }}>
          {format(selected, 'EEEE, MMMM d, yyyy')}
        </span>
        <span style={{ fontSize: 10, color: 'var(--pink-deep)' }}>done</span>
      </button>

      <div style={{ border: '1px solid var(--cream-deep)', padding: 16, maxWidth: 320 }}>
        {/* Month nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <button onClick={() => setViewMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            style={{ background: 'none', border: 'none', fontSize: 14, color: 'var(--ink-light)', cursor: 'pointer', padding: '4px 8px' }}>←</button>
          <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ink)' }}>
            {format(viewMonth, 'MMM yyyy')}
          </span>
          <button onClick={() => setViewMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            style={{ background: 'none', border: 'none', fontSize: 14, color: 'var(--ink-light)', cursor: 'pointer', padding: '4px 8px' }}>→</button>
        </div>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: 9, fontWeight: 500, letterSpacing: 1, color: 'var(--ink-light)', padding: '4px 0' }}>{d}</div>
          ))}
        </div>

        {/* Day grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {days.map((day, i) => {
            const isSelected = isSameDay(day, selected)
            const isCurrMonth = isSameMonth(day, viewMonth)
            const isTdy = isSameDay(day, new Date())
            return (
              <button key={i} onClick={() => { onChange(format(day, 'yyyy-MM-dd')); setOpen(false) }}
                style={{
                  width: '100%', aspectRatio: '1', border: 'none', borderRadius: '50%',
                  backgroundColor: isSelected ? 'var(--ink)' : isTdy ? 'var(--pink-light)' : 'transparent',
                  color: isSelected ? 'var(--cream)' : isCurrMonth ? 'var(--ink)' : 'var(--cream-deep)',
                  fontSize: 12, fontWeight: isSelected ? 500 : 300, cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif", transition: 'all 0.15s ease',
                }}>{format(day, 'd')}</button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ─── Post/Event Modal ─── */
function PostModal({ date: initialDate, post, currentUser, setPosts, onClose }) {
  const [modalDate, setModalDate] = useState(initialDate)
  const date = modalDate
  const [eventType, setEventType] = useState(post?.content_type === 'meeting' || post?.content_type === 'holiday' ? post.content_type : (post?.platform === 'meeting' || post?.platform === 'holiday' || post?.platform === 'other-event' ? post.platform.replace('-event','') : 'post'))
  const [form, setForm] = useState({
    platform: post?.platform || 'instagram',
    content_type: post?.content_type || 'Post',
    caption: post?.caption || '',
    status: post?.status || 'draft',
    assigned_to: post?.assigned_to || currentUser || 'natalie',
    time: post?.time || '',
  })
  const [saving, setSaving] = useState(false)
  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    setSaving(true)
    try {
      let payload
      if (eventType === 'post') {
        payload = { ...form, date, updated_at: new Date().toISOString() }
      } else if (eventType === 'meeting') {
        payload = { date, platform: 'meeting', content_type: 'meeting', caption: form.caption, status: form.time ? `${form.time}|${form.status || ''}` : (form.status || 'scheduled'), assigned_to: form.assigned_to, updated_at: new Date().toISOString() }
      } else if (eventType === 'holiday') {
        payload = { date, platform: 'holiday', content_type: 'holiday', caption: form.caption, status: form.status || 'scheduled', assigned_to: 'both', updated_at: new Date().toISOString() }
      } else {
        payload = { date, platform: 'other-event', content_type: 'other', caption: form.caption, status: form.status || 'draft', assigned_to: form.assigned_to, updated_at: new Date().toISOString() }
      }
      if (post) {
        const { data, error } = await supabase.from('calendar_posts').update(payload).eq('id', post.id).select()
        if (!error && data?.[0]) setPosts(prev => prev.map(p => p.id === post.id ? data[0] : p))
      } else {
        const { data, error } = await supabase.from('calendar_posts').insert([payload]).select()
        if (!error && data?.[0]) setPosts(prev => { if (prev.find(p => p.id === data[0].id)) return prev; return [...prev, data[0]] })
      }
      onClose()
    } catch (err) { console.error('Error saving:', err) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!post) return
    const { error } = await supabase.from('calendar_posts').delete().eq('id', post.id)
    if (!error) setPosts(prev => prev.filter(p => p.id !== post.id))
    onClose()
  }

  const contentTypes = CONTENT_TYPES[form.platform] || ['Post']
  const titles = { post: post ? 'Edit Post' : 'New Post', meeting: post ? 'Edit Meeting' : 'New Meeting', holiday: post ? 'Edit Holiday' : 'New Holiday', other: post ? 'Edit Event' : 'New Event' }
  const inputStyle = { width: '100%', border: 'none', borderBottom: '1px solid var(--cream-deep)', background: 'transparent', padding: '10px 0', fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 300, color: 'var(--ink)', outline: 'none' }

  const PillSelect = ({ options, value, onChange }) => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map(opt => (
        <button key={opt} onClick={() => onChange(opt)}
          style={{ padding: '6px 16px', borderRadius: 9999, border: 'none', backgroundColor: value === opt ? 'var(--ink)' : 'var(--cream-mid)', color: value === opt ? 'var(--cream)' : 'var(--ink-mid)', fontSize: 11, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase', transition: 'all 0.2s ease' }}>{opt}</button>
      ))}
    </div>
  )

  return (
    <Modal onClose={onClose}>
      <div style={{ padding: 32, position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', fontSize: 20, color: 'var(--ink-light)', lineHeight: 1, padding: 4 }}>&times;</button>
        <h2 style={{ fontSize: 11, fontWeight: 500, letterSpacing: 4, textTransform: 'uppercase', color: 'var(--ink-light)', marginBottom: 20 }}>
          {titles[eventType]}
        </h2>
        {date && <ModalDatePicker date={date} onChange={setModalDate} />}

        {/* Event type selector */}
        <div style={{ marginBottom: 24 }}>
          <label className="form-label">Type</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {EVENT_TYPES.map(t => (
              <button key={t} onClick={() => { setEventType(t); if (t !== 'meeting') update('time', '') }}
                style={{ padding: '6px 16px', borderRadius: 9999, border: 'none', backgroundColor: eventType === t ? EVENT_COLORS[t] : 'var(--cream-mid)', color: eventType === t ? '#fff' : 'var(--ink-mid)', fontSize: 11, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase', transition: 'all 0.2s ease' }}>{t}</button>
            ))}
          </div>
        </div>

        {/* POST fields */}
        {eventType === 'post' && (<>
          <div style={{ marginBottom: 24 }}>
            <label className="form-label">Platform</label>
            <PillSelect options={PLATFORMS} value={form.platform} onChange={(v) => { update('platform', v); update('content_type', CONTENT_TYPES[v]?.[0] || 'Post') }} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label className="form-label">Content Type</label>
            <PillSelect options={contentTypes} value={form.content_type} onChange={(v) => update('content_type', v)} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label className="form-label">Caption / Copy</label>
            <textarea rows={4} value={form.caption} onChange={(e) => update('caption', e.target.value)} placeholder="Write your caption..." style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div style={{ marginBottom: 32 }}>
            <label className="form-label">Assigned to</label>
            <PillSelect options={ASSIGNEES.map(capitalize)} value={capitalize(form.assigned_to)} onChange={(v) => update('assigned_to', v.toLowerCase())} />
          </div>
        </>)}

        {/* MEETING fields */}
        {eventType === 'meeting' && (<>
          <div style={{ marginBottom: 24 }}>
            <label className="form-label">Title</label>
            <input type="text" value={form.content_type === 'meeting' ? form.caption.split('\n')[0] || '' : form.caption} onChange={(e) => update('caption', e.target.value)} placeholder="Meeting title" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label className="form-label">Time</label>
            <input type="time" value={form.time || ''} onChange={(e) => update('time', e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label className="form-label">Attendees</label>
            <PillSelect options={ASSIGNEES.map(capitalize)} value={capitalize(form.assigned_to)} onChange={(v) => update('assigned_to', v.toLowerCase())} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label className="form-label">Location / Link</label>
            <input type="text" value={form.status} onChange={(e) => update('status', e.target.value)} placeholder="Zoom link or address" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 32 }}>
            <label className="form-label">Notes</label>
            <textarea rows={3} value={form.content_type === 'meeting' ? '' : ''} onChange={() => {}} placeholder="Meeting notes..." style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </>)}

        {/* HOLIDAY fields */}
        {eventType === 'holiday' && (<>
          <div style={{ marginBottom: 24 }}>
            <label className="form-label">Holiday Name</label>
            <input type="text" value={form.caption} onChange={(e) => update('caption', e.target.value)} placeholder="Mother's Day" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label className="form-label">Category</label>
            <PillSelect options={['federal', 'cultural', 'retail', 'custom']} value={form.status} onChange={(v) => update('status', v)} />
          </div>
          <div style={{ marginBottom: 32 }}>
            <label className="form-label">Notes</label>
            <textarea rows={2} value={''} onChange={() => {}} placeholder="Content angle or reminder..." style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </>)}

        {/* OTHER fields */}
        {eventType === 'other' && (<>
          <div style={{ marginBottom: 24 }}>
            <label className="form-label">Title</label>
            <input type="text" value={form.caption} onChange={(e) => update('caption', e.target.value)} placeholder="Event title" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label className="form-label">Notes</label>
            <textarea rows={3} value={''} onChange={() => {}} placeholder="Details..." style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div style={{ marginBottom: 32 }}>
            <label className="form-label">Assigned to</label>
            <PillSelect options={ASSIGNEES.map(capitalize)} value={capitalize(form.assigned_to)} onChange={(v) => update('assigned_to', v.toLowerCase())} />
          </div>
        </>)}

        <button className="btn-save" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        {post && (
          <button style={{ marginTop: 16, color: 'var(--ink-light)', display: 'block', textAlign: 'center', width: '100%', fontSize: 11, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase', background: 'none', border: 'none' }}
            onClick={handleDelete}>Delete</button>
        )}
      </div>
    </Modal>
  )
}

/* ─── Recent Meeting Notes (below calendar) ─── */
function RecentMeetingNotes() {
  const [notes, setNotes] = useState([])

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('notes')
        .select('*')
        .order('month', { ascending: false })
        .limit(5)
      if (data) setNotes(data)
    }
    load()

    const channel = supabase
      .channel('calendar-notes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' },
        () => load()
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  if (notes.length === 0) return null

  const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : ''

  return (
    <div style={{ marginTop: 48, borderTop: '1px solid var(--cream-deep)', paddingTop: 24 }}>
      <span style={{
        fontSize: 10, fontWeight: 500, letterSpacing: 3,
        textTransform: 'uppercase', color: 'var(--ink-light)',
        display: 'block', marginBottom: 20,
      }}>Recent Meeting Notes</span>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {notes.map(note => {
          let dateLabel = note.month
          try { dateLabel = format(parseISO(note.month), 'EEE, MMM d') } catch {}
          return (
            <div key={note.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 16,
              padding: '16px 0', borderBottom: '1px solid var(--cream-deep)',
            }}>
              <div style={{ flexShrink: 0, width: 80 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{dateLabel}</span>
                {note.updated_by && (
                  <span style={{
                    display: 'block', marginTop: 4, fontSize: 9, fontWeight: 500,
                    color: note.updated_by === 'natalie' ? 'var(--pink-deep)' : 'var(--ink-light)',
                  }}>{capitalize(note.updated_by)}</span>
                )}
              </div>
              <p style={{
                fontSize: 13, fontWeight: 300, color: 'var(--ink-mid)',
                lineHeight: 1.6, flex: 1,
                overflow: 'hidden', textOverflow: 'ellipsis',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              }}>
                {note.content || 'No notes'}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
