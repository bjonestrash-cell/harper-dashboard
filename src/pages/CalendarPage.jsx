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
  const [view, setView] = useState('month')
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedPost, setSelectedPost] = useState(null)
  const [showModal, setShowModal] = useState(false)

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

  const { data: posts } = useRealtime('calendar_posts', fetchPosts, [format(currentMonth, 'yyyy-MM')])
  const { data: promotions } = useRealtime('promotions', fetchPromos, [format(currentMonth, 'yyyy-MM')])

  const days = []
  let day = calendarStart
  while (day <= calendarEnd) {
    days.push(day)
    day = addDays(day, 1)
  }

  const getPostsForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return posts.filter(p => p.date === dateStr)
  }

  const getPromosForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return promotions.filter(p => {
      return p.start_date <= dateStr && p.end_date >= dateStr
    })
  }

  const isPromoStart = (promo, date) => {
    return promo.start_date === format(date, 'yyyy-MM-dd')
  }

  const handleDayClick = (date) => {
    setSelectedDate(format(date, 'yyyy-MM-dd'))
    setSelectedPost(null)
    setShowModal(true)
  }

  const handlePostClick = (post) => {
    setSelectedPost(post)
    setSelectedDate(post.date)
    setShowModal(true)
  }

  return (
    <div className="calendar-page">
      <div className="page-header">
        <h1 className="page-title">Content Calendar</h1>
        <div className="view-toggle">
          <button
            className={`pill ${view === 'month' ? 'active' : ''}`}
            onClick={() => setView('month')}
          >Month</button>
          <button
            className={`pill ${view === 'week' ? 'active' : ''}`}
            onClick={() => setView('week')}
          >Week</button>
        </div>
      </div>

      <MonthSelector />

      {view === 'month' ? (
        <MonthGrid
          days={days}
          currentMonth={currentMonth}
          getPostsForDate={getPostsForDate}
          getPromosForDate={getPromosForDate}
          isPromoStart={isPromoStart}
          onDayClick={handleDayClick}
          onPostClick={handlePostClick}
        />
      ) : (
        <WeekView
          currentMonth={currentMonth}
          posts={posts}
          onPostClick={handlePostClick}
          onDayClick={handleDayClick}
        />
      )}

      {showModal && (
        <PostModal
          date={selectedDate}
          post={selectedPost}
          onClose={() => { setShowModal(false); setSelectedPost(null) }}
        />
      )}
    </div>
  )
}

function MonthGrid({ days, currentMonth, getPostsForDate, getPromosForDate, isPromoStart, onDayClick, onPostClick }) {
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
                  <div
                    key={promo.id}
                    className="promo-banner"
                    style={{ background: promo.color || '#F4A7B9' }}
                    onClick={(e) => { e.stopPropagation() }}
                    title={promo.name}
                  >
                    {promo.name}
                  </div>
                ) : (
                  <div
                    key={promo.id}
                    className="promo-banner-continue"
                    style={{ background: promo.color || '#F4A7B9' }}
                  />
                )
              ))}
            </div>

            <div className="cell-posts">
              {dayPosts.map(post => (
                <PostPill
                  key={post.id}
                  post={post}
                  onClick={(e) => { e.stopPropagation(); onPostClick(post) }}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function WeekView({ currentMonth, posts, onPostClick, onDayClick }) {
  const weekStart = startOfWeek(currentMonth)
  const weekEnd = endOfWeek(currentMonth)
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const hours = Array.from({ length: 12 }, (_, i) => i + 9) // 9am-8pm

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
                    <PostPill
                      key={post.id}
                      post={post}
                      onClick={(e) => { e.stopPropagation(); onPostClick(post) }}
                    />
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

function PostModal({ date, post, onClose }) {
  const [form, setForm] = useState({
    platform: post?.platform || 'instagram',
    content_type: post?.content_type || 'Post',
    caption: post?.caption || '',
    status: post?.status || 'draft',
    assigned_to: post?.assigned_to || 'natalie',
  })
  const [saving, setSaving] = useState(false)

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const data = { ...form, date, updated_at: new Date().toISOString() }
      if (post) {
        await supabase.from('calendar_posts').update(data).eq('id', post.id)
      } else {
        await supabase.from('calendar_posts').insert(data)
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
    await supabase.from('calendar_posts').delete().eq('id', post.id)
    onClose()
  }

  const contentTypes = CONTENT_TYPES[form.platform] || ['Post']

  return (
    <Modal onClose={onClose}>
      <div style={{ padding: '32px' }}>
        <h2 className="section-header" style={{ marginBottom: 24 }}>
          {post ? 'Edit Post' : 'New Post'} — {date && format(parseISO(date), 'MMM d, yyyy')}
        </h2>

        <div className="form-group">
          <label className="form-label">Platform</label>
          <div className="pill-group">
            {PLATFORMS.map(p => (
              <button
                key={p}
                className={`pill ${form.platform === p ? 'active' : ''}`}
                onClick={() => { update('platform', p); update('content_type', CONTENT_TYPES[p]?.[0] || 'Post') }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Content Type</label>
          <div className="pill-group">
            {contentTypes.map(t => (
              <button
                key={t}
                className={`pill ${form.content_type === t ? 'active' : ''}`}
                onClick={() => update('content_type', t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Caption / Copy</label>
          <textarea
            rows={4}
            value={form.caption}
            onChange={(e) => update('caption', e.target.value)}
            placeholder="Write your caption..."
            style={{ width: '100%' }}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Status</label>
          <div className="pill-group">
            {STATUSES.map(s => (
              <button
                key={s}
                className={`pill ${form.status === s ? 'active' : ''}`}
                onClick={() => update('status', s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Assigned to</label>
          <div className="pill-group">
            {ASSIGNEES.map(a => (
              <button
                key={a}
                className={`pill ${form.assigned_to === a ? 'active' : ''}`}
                onClick={() => update('assigned_to', a)}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <button className="btn-save" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>

        {post && (
          <button
            className="promo-action"
            style={{ marginTop: 12, color: '#C0392B', display: 'block', textAlign: 'center', width: '100%' }}
            onClick={handleDelete}
          >
            Delete post
          </button>
        )}
      </div>
    </Modal>
  )
}
