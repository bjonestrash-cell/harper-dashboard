import { useState, useCallback, useEffect, useRef } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays,
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
        <MonthSelector />

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

        {/* Selected day posts panel */}
        {selectedDay && !isMobile && (
          <div style={{ marginTop: 32, borderTop: '1px solid var(--cream-deep)', paddingTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--ink-light)' }}>
                {format(selectedDay, 'MMMM d, yyyy')}
              </span>
              <button
                onClick={() => openAddModal(selectedDay)}
                className="add-post-inline"
              >
                + Add Post
              </button>
            </div>

            {selectedDayPosts.length === 0 ? (
              <p style={{ fontSize: 13, fontWeight: 300, color: 'var(--ink-light)' }}>
                Nothing scheduled for this day.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedDayPosts.map(post => (
                  <div key={post.id} style={{
                    display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px',
                    backgroundColor: 'var(--white)', border: '1px solid var(--cream-deep)',
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      backgroundColor: post.platform === 'instagram' ? '#F4A7B9' : post.platform === 'tiktok' ? '#1a1a2e' : post.platform === 'email' ? '#A8D4A8' : '#C4B8A8',
                    }}/>
                    <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ink-light)', width: 100, flexShrink: 0 }}>
                      {post.platform} &middot; {post.content_type}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 300, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {post.caption || 'No caption'}
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase',
                      color: post.status === 'posted' ? '#5C7A5C' : 'var(--ink-light)',
                      backgroundColor: post.status === 'posted' ? '#EDF3ED' : 'var(--cream-mid)',
                      padding: '3px 10px', borderRadius: 20,
                    }}>{post.status}</span>
                    <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase', flexShrink: 0, color: post.assigned_to === 'natalie' ? '#D4849A' : 'var(--ink-light)' }}>
                      {post.assigned_to}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); deletePost(post.id) }}
                      style={{ background: 'none', border: 'none', color: 'var(--ink-light)', fontSize: 16, padding: 4, lineHeight: 1 }}>&times;</button>
                  </div>
                ))}
              </div>
            )}

            {/* Daily notes section */}
            <div style={{ marginTop: 32, borderTop: '1px solid var(--cream-deep)', paddingTop: 24 }}>
              <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--ink-light)', display: 'block', marginBottom: 20 }}>
                Notes — {format(selectedDay, 'MMMM d')}
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <DailyNoteColumn date={selectedDay} author="natalie" label="Natalie" accentColor="#F4A7B9" currentUser={currentUser} />
                <DailyNoteColumn date={selectedDay} author="shared" label="Shared" accentColor="#C4B8A8" currentUser={currentUser} />
                <DailyNoteColumn date={selectedDay} author="grace" label="Grace" accentColor="#D4C4A8" currentUser={currentUser} />
              </div>
            </div>
          </div>
        )}
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
  const hours = Array.from({ length: 12 }, (_, i) => i + 9)
  const isMobileView = window.innerWidth < 768

  return (
    <div className="week-view">
      <div className="week-header">
        <div className="week-time-col" />
        {weekDays.map(day => (
          <div key={day.toString()} className={`week-day-header ${isToday(day) ? 'week-today' : ''}`}>
            <span className="week-day-name">{isMobileView ? format(day, 'EEEEE') : format(day, 'EEE')}</span>
            <span className={`week-day-number ${isToday(day) ? 'today-number' : ''}`}>{format(day, 'd')}</span>
          </div>
        ))}
      </div>
      <div className="week-body">
        {hours.map(hour => (
          <div key={hour} className="week-row">
            <div className="week-time-label">
              {isMobileView
                ? (hour > 12 ? `${hour-12}p` : hour === 12 ? '12p' : `${hour}a`)
                : (hour > 12 ? `${hour-12}pm` : hour === 12 ? '12pm' : `${hour}am`)
              }
            </div>
            {weekDays.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const dayPosts = posts.filter(p => p.date === dateStr)
              return (
                <div key={day.toString()} className="week-cell" onClick={() => onDayClick(day)}>
                  {hour === 9 && dayPosts.map(post => (
                    <PostPill key={post.id} post={post} showAssignee={calendarView === 'master'}
                      currentUser={currentUser} onClick={(e) => onPostClick(post, e)} />
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

/* ─── Mobile Day Panel ─── */
function MobileDayPanel({ date, posts, calendarView, currentUser, onClose, onPostClick, onAdd }) {
  return (
    <div className="mobile-day-overlay" onClick={onClose}>
      <div className="mobile-day-panel" onClick={e => e.stopPropagation()}>
        <div className="mobile-day-header">
          <h3 style={{ fontSize: 11, fontWeight: 500, letterSpacing: 4, textTransform: 'uppercase', color: 'var(--ink-light)' }}>
            {format(date, 'EEEE, MMMM d')}
          </h3>
          <button onClick={onClose} style={{ fontSize: 20, color: 'var(--ink-light)' }}>&times;</button>
        </div>
        <div className="mobile-day-posts">
          {posts.length === 0 && <p className="caption" style={{ padding: 16 }}>No posts for this day</p>}
          {posts.map(post => (
            <PostPill key={post.id} post={post} showAssignee={calendarView === 'master'}
              currentUser={currentUser} onClick={(e) => onPostClick(post, e)} />
          ))}
        </div>
        <button className="btn-save" onClick={onAdd} style={{ margin: 16 }}>+ Add Post</button>
      </div>
    </div>
  )
}

/* ─── Post Modal ─── */
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
        if (!error && data?.[0]) setPosts(prev => prev.map(p => p.id === post.id ? data[0] : p))
      } else {
        const { data, error } = await supabase.from('calendar_posts').insert([payload]).select()
        if (!error && data?.[0]) setPosts(prev => { if (prev.find(p => p.id === data[0].id)) return prev; return [...prev, data[0]] })
      }
      onClose()
    } catch (err) { console.error('Error saving post:', err) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!post) return
    const { error } = await supabase.from('calendar_posts').delete().eq('id', post.id)
    if (!error) setPosts(prev => prev.filter(p => p.id !== post.id))
    onClose()
  }

  const contentTypes = CONTENT_TYPES[form.platform] || ['Post']

  const PillSelect = ({ options, value, onChange }) => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map(opt => (
        <button key={opt} onClick={() => onChange(opt)}
          style={{
            padding: '6px 16px', borderRadius: 20, border: 'none',
            backgroundColor: value === opt ? 'var(--ink)' : 'var(--cream-mid)',
            color: value === opt ? 'var(--cream)' : 'var(--ink-mid)',
            fontSize: 11, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase', transition: 'all 0.2s ease',
          }}>{opt}</button>
      ))}
    </div>
  )

  return (
    <Modal onClose={onClose}>
      <div style={{ padding: 32, position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', fontSize: 20, color: 'var(--ink-light)', lineHeight: 1, padding: 4 }}>&times;</button>
        <h2 style={{ fontSize: 11, fontWeight: 500, letterSpacing: 4, textTransform: 'uppercase', color: 'var(--ink-light)', marginBottom: 24 }}>
          {post ? 'Edit Post' : 'New Post'}
        </h2>
        {date && <p style={{ fontSize: 12, fontWeight: 300, color: 'var(--ink-light)', marginBottom: 24 }}>{format(parseISO(date), 'EEEE, MMMM d, yyyy')}</p>}

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
          <textarea rows={4} value={form.caption} onChange={(e) => update('caption', e.target.value)} placeholder="Write your caption..."
            style={{ width: '100%', border: 'none', borderBottom: '1px solid var(--cream-deep)', background: 'transparent', padding: '10px 0', fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 300, color: 'var(--ink)', outline: 'none', resize: 'vertical' }}
            onFocus={(e) => e.target.style.borderBottomColor = 'var(--pink-deep)'} onBlur={(e) => e.target.style.borderBottomColor = 'var(--cream-deep)'} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label className="form-label">Status</label>
          <PillSelect options={STATUSES} value={form.status} onChange={(v) => update('status', v)} />
        </div>
        <div style={{ marginBottom: 32 }}>
          <label className="form-label">Assigned to</label>
          <PillSelect options={ASSIGNEES.map(capitalize)} value={capitalize(form.assigned_to)} onChange={(v) => update('assigned_to', v.toLowerCase())} />
        </div>
        <button className="btn-save" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        {post && (
          <button style={{ marginTop: 16, color: 'var(--ink-light)', display: 'block', textAlign: 'center', width: '100%', fontSize: 11, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase', background: 'none', border: 'none' }}
            onClick={handleDelete}>Delete post</button>
        )}
      </div>
    </Modal>
  )
}
