import { useState, useEffect, useRef } from 'react'
import { format, parseISO, subDays } from 'date-fns'
import { supabase, createChannel } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import DatePicker from '../components/DatePicker'
import SwipeToDelete from '../components/SwipeToDelete'
import RichEditor from '../components/RichEditor'
import Modal from '../components/Modal'
import './NotesPage.css'

export default function NotesPage() {
  const currentUser = localStorage.getItem('harper-user') || 'natalie'
  const [meetings, setMeetings] = useState([])
  const [selectedMeeting, setSelectedMeeting] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saveStatus, setSaveStatus] = useState('saved')
  const saveTimer = useRef(null)

  // Load all meetings
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('notes')
        .select('*')
        .neq('month', '9999-01-01')
        .order('month', { ascending: false })
      setMeetings(data || [])
    }
    load()
  }, [])

  // Real-time subscription
  useEffect(() => {
    const channel = createChannel('notes_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notes' },
        (payload) => setMeetings(prev => {
          if (prev.find(m => m.id === payload.new.id)) return prev
          return [payload.new, ...prev]
        })
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notes' },
        (payload) => {
          setMeetings(prev => prev.map(m => m.id === payload.new.id ? payload.new : m))
          if (selectedMeeting?.id === payload.new.id) setSelectedMeeting(payload.new)
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notes' },
        (payload) => {
          setMeetings(prev => prev.filter(m => m.id !== payload.old.id))
          if (selectedMeeting?.id === payload.old.id) setSelectedMeeting(null)
        }
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [selectedMeeting?.id])

  // When selecting a meeting, load its content into the editor
  useEffect(() => {
    if (selectedMeeting) {
      setEditContent(selectedMeeting.content || '')
      setSaveStatus('saved')
    }
  }, [selectedMeeting?.id])

  const deleteMeeting = async (id) => {
    if (!window.confirm('Delete this meeting note?')) return
    const { error } = await supabase.from('notes').delete().eq('id', id)
    if (!error) {
      setMeetings(prev => prev.filter(m => m.id !== id))
      if (selectedMeeting?.id === id) setSelectedMeeting(null)
    }
  }

  // Inline auto-save
  const handleContentChange = (val) => {
    setEditContent(val)
    setSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (!selectedMeeting) return
      await supabase.from('notes').update({
        content: val,
        updated_at: new Date().toISOString(),
        updated_by: currentUser,
      }).eq('id', selectedMeeting.id)
      setSaveStatus('saved')
    }, 2000)
  }

  const formatMeetingDate = (m) => {
    try { return format(parseISO(m.month), 'EEE, MMM d') } catch { return m.month }
  }

  const formatMeetingDateFull = (m) => {
    try { return format(parseISO(m.month), 'EEEE, MMMM d yyyy') } catch { return m.month }
  }

  const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : ''

  return (
    <div className="notes-page">
      <PageHeader title="Meeting Notes" />
      <div className="meeting-layout">
        {/* LEFT PANEL */}
        <div className="meeting-sidebar">
          <div className="meeting-sidebar-header" />

          <button className="new-meeting-btn" onClick={() => {
            const newMeeting = {
              id: crypto.randomUUID(),
              month: format(new Date(), 'yyyy-MM-dd'),
              content: '',
              updated_by: currentUser,
              updated_at: new Date().toISOString(),
            }
            setMeetings(prev => [newMeeting, ...prev])
            setSelectedMeeting(newMeeting)
            supabase.from('notes').insert([{
              month: newMeeting.month, content: '', updated_by: currentUser, updated_at: newMeeting.updated_at
            }]).select().single().then(({ data }) => {
              if (data) {
                setMeetings(prev => prev.map(m => m.id === newMeeting.id ? data : m))
                setSelectedMeeting(data)
              }
            })
          }}
            style={{
            }}>
            + New Meeting
          </button>

          <div className="meeting-list">
            {meetings.map(m => (
              <SwipeToDelete key={m.id} onDelete={() => deleteMeeting(m.id)}>
                <div
                  className={`meeting-item ${selectedMeeting?.id === m.id ? 'active' : ''}`}
                  onClick={() => setSelectedMeeting(m)}
                >
                  <button
                    className="meeting-delete-btn"
                    onClick={(e) => { e.stopPropagation(); deleteMeeting(m.id) }}
                  >&times;</button>
                  <span className="meeting-item-date">{formatMeetingDate(m)}</span>
                  <div className="meeting-item-row">
                    <span className={`meeting-author-chip ${m.updated_by === 'natalie' ? 'natalie' : 'grace'}`}>
                      {capitalize(m.updated_by || 'unknown')}
                    </span>
                    <span className="meeting-item-preview">
                      {m.content ? m.content.substring(0, 40) + (m.content.length > 40 ? '...' : '') : 'Empty'}
                    </span>
                  </div>
                </div>
              </SwipeToDelete>
            ))}
            {meetings.length === 0 && (
              <p style={{ padding: 16, fontSize: 13, fontWeight: 300, color: 'var(--ink-light)' }}>No meetings yet</p>
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="meeting-detail">
          {!selectedMeeting ? (
            <div className="meeting-empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 300, color: 'var(--ink-light)' }}>
                Start a new meeting note
              </p>
              <button
                onClick={() => {
                  const newMeeting = {
                    id: crypto.randomUUID(),
                    month: format(new Date(), 'yyyy-MM-dd'),
                    content: '',
                    updated_by: currentUser,
                    updated_at: new Date().toISOString(),
                  }
                  setMeetings(prev => [newMeeting, ...prev])
                  setSelectedMeeting(newMeeting)
                  // Also try Supabase
                  supabase.from('notes').insert([{
                    month: newMeeting.month, content: '', updated_by: currentUser, updated_at: newMeeting.updated_at
                  }]).select().single().then(({ data }) => {
                    if (data) {
                      setMeetings(prev => prev.map(m => m.id === newMeeting.id ? data : m))
                      setSelectedMeeting(data)
                    }
                  })
                }}
                style={{
                  backgroundColor: 'var(--ink)', color: 'var(--cream)', border: 'none',
                  borderRadius: 9999, padding: '10px 28px', fontSize: 11, fontWeight: 500,
                  letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'Inter, sans-serif',
                }}
              >Start Writing</button>
            </div>
          ) : (
            <>
              <div className="meeting-detail-header">
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 300, letterSpacing: 0.5, color: 'var(--ink)', marginBottom: 8 }}>
                    {formatMeetingDateFull(selectedMeeting)}
                  </h2>
                  <span className={`meeting-author-chip ${selectedMeeting.updated_by === 'natalie' ? 'natalie' : 'grace'}`}>
                    by {capitalize(selectedMeeting.updated_by || 'unknown')}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 400, letterSpacing: 1,
                    color: saveStatus === 'saved' ? 'var(--ink-light)' : 'var(--pink-deep)',
                    fontFamily: 'Inter, sans-serif',
                  }}>
                    {saveStatus === 'saved' ? 'Saved \u2713' : 'Saving...'}
                  </span>
                  <button
                    onClick={() => setSelectedMeeting(null)}
                    style={{
                      background: 'none', border: 'none', fontSize: 11,
                      fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase',
                      color: 'var(--ink-light)', fontFamily: 'Inter, sans-serif',
                      padding: '8px 0', transition: 'color 0.2s',
                    }}
                  >Close</button>
                  <button
                    onClick={async () => {
                      if (!window.confirm('Delete this meeting note? This cannot be undone.')) return
                      const { error } = await supabase.from('notes').delete().eq('id', selectedMeeting.id)
                      if (!error) {
                        setMeetings(prev => prev.filter(m => m.id !== selectedMeeting.id))
                        setSelectedMeeting(null)
                      }
                    }}
                    style={{
                      background: 'none', border: 'none', fontSize: 11,
                      fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase',
                      color: 'var(--ink-light)', fontFamily: 'Inter, sans-serif',
                      padding: '8px 0', transition: 'color 0.2s',
                    }}
                    onMouseEnter={e => e.target.style.color = '#B85450'}
                    onMouseLeave={e => e.target.style.color = 'var(--ink-light)'}
                  >Delete</button>
                </div>
              </div>

              <div className="meeting-divider" />

              <div className="meeting-content-area">
                <RichEditor
                  content={editContent}
                  onChange={handleContentChange}
                  placeholder="Start typing your meeting notes..."
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add Meeting Modal */}
      {showAddModal && (
        <AddMeetingModal
          currentUser={currentUser}
          setMeetings={setMeetings}
          setSelectedMeeting={setSelectedMeeting}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  )
}

function AddMeetingModal({ currentUser, setMeetings, setSelectedMeeting, onClose }) {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const quickDates = [
    { label: 'Today', value: format(new Date(), 'yyyy-MM-dd') },
    { label: 'Yesterday', value: format(subDays(new Date(), 1), 'yyyy-MM-dd') },
    { label: format(subDays(new Date(), 2), 'EEE MMM d'), value: format(subDays(new Date(), 2), 'yyyy-MM-dd') },
    { label: format(subDays(new Date(), 3), 'EEE MMM d'), value: format(subDays(new Date(), 3), 'yyyy-MM-dd') },
    { label: format(subDays(new Date(), 4), 'EEE MMM d'), value: format(subDays(new Date(), 4), 'yyyy-MM-dd') },
  ]

  const handleDone = async () => {
    if (!notes.trim()) return
    setSaving(true)
    try {
      const newMeeting = {
        id: crypto.randomUUID(),
        month: date,
        content: notes,
        updated_by: currentUser,
        updated_at: new Date().toISOString(),
      }
      const { data, error } = await supabase
        .from('notes')
        .insert([{ month: date, content: notes, updated_by: currentUser, updated_at: new Date().toISOString() }])
        .select()
        .single()
      const saved = (!error && data) ? data : newMeeting
      setMeetings(prev => {
        if (prev.find(m => m.id === saved.id)) return prev
        return [saved, ...prev]
      })
      setSelectedMeeting(saved)
      onClose()
    } catch (err) {
      // Save locally even if Supabase fails
      const fallback = { id: crypto.randomUUID(), month: date, content: notes, updated_by: currentUser, updated_at: new Date().toISOString() }
      setMeetings(prev => [fallback, ...prev])
      setSelectedMeeting(fallback)
      onClose()
    }
    setSaving(false)
  }

  return (
    <Modal onClose={onClose}>
      <div style={{ padding: 40, position: 'relative', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto' }}>
        <button onClick={onClose}
          style={{ position: 'absolute', top: 24, right: 24, background: 'none', border: 'none', fontSize: 22, color: 'var(--ink-light)', lineHeight: 1, padding: 4, transition: 'color 0.2s' }}
          onMouseEnter={e => e.target.style.color = 'var(--ink)'}
          onMouseLeave={e => e.target.style.color = 'var(--ink-light)'}
        >&times;</button>

        <h2 style={{ fontSize: 14, fontWeight: 500, letterSpacing: 1, marginBottom: 32, color: 'var(--ink)' }}>New Meeting</h2>

        <div style={{ marginBottom: 28 }}>
          <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--ink-light)', display: 'block', marginBottom: 10 }}>Date</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {quickDates.map(qd => (
              <button key={qd.value} onClick={() => setDate(qd.value)}
                style={{
                  padding: '6px 14px', borderRadius: 20, border: 'none',
                  backgroundColor: date === qd.value ? 'var(--ink)' : 'var(--cream-mid)',
                  color: date === qd.value ? 'var(--cream)' : 'var(--ink-mid)',
                  fontSize: 11, fontWeight: 500, letterSpacing: 0.5, transition: 'all 0.2s ease',
                  fontFamily: 'Inter, sans-serif',
                }}>{qd.label}</button>
            ))}
          </div>
          <div style={{ marginTop: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 300, color: 'var(--ink-light)', marginBottom: 4, display: 'block' }}>or pick a date:</span>
            <DatePicker value={date} onChange={setDate} />
          </div>
        </div>

        <div style={{ marginBottom: 36 }}>
          <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--ink-light)', display: 'block', marginBottom: 8 }}>Notes</span>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="What was discussed..."
            autoFocus
            style={{
              width: '100%', minHeight: 280, border: 'none',
              borderBottom: '1px solid var(--cream-deep)',
              outline: 'none', resize: 'none',
              fontFamily: 'Inter, sans-serif', fontSize: 15,
              fontWeight: 300, lineHeight: 1.9, color: 'var(--ink)',
              backgroundColor: 'transparent', marginTop: 8, padding: '12px 0',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, alignItems: 'center' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--ink-light)' }}>Cancel</button>
          <button onClick={handleDone} disabled={saving}
            style={{
              backgroundColor: 'var(--ink)', color: 'var(--cream)',
              border: 'none', padding: '12px 32px', fontSize: 11,
              fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase',
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--pink-deep)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--ink)'}
          >{saving ? 'Saving...' : 'Done'}</button>
        </div>
      </div>
    </Modal>
  )
}
