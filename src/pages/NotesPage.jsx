import { useState, useEffect } from 'react'
import { format, parseISO, subDays } from 'date-fns'
import { supabase } from '../lib/supabase'
import DatePicker from '../components/DatePicker'
import Modal from '../components/Modal'
import './NotesPage.css'

export default function NotesPage() {
  const currentUser = localStorage.getItem('harper-user') || 'natalie'
  const [meetings, setMeetings] = useState([])
  const [selectedMeeting, setSelectedMeeting] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')

  // Load all meetings
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('notes')
        .select('*')
        .order('month', { ascending: false })
      setMeetings(data || [])
    }
    load()
  }, [])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('notes_changes')
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

  const deleteMeeting = async (id) => {
    if (!window.confirm('Delete this meeting note?')) return
    await supabase.from('notes').delete().eq('id', id)
  }

  const startEdit = () => {
    setEditContent(selectedMeeting?.content || '')
    setEditing(true)
  }

  const saveEdit = async () => {
    if (!selectedMeeting) return
    await supabase.from('notes').update({
      content: editContent,
      updated_at: new Date().toISOString(),
      updated_by: currentUser,
    }).eq('id', selectedMeeting.id)
    setEditing(false)
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
      <div className="meeting-layout">
        {/* LEFT PANEL */}
        <div className="meeting-sidebar">
          <div className="meeting-sidebar-header">
            <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: 4, textTransform: 'uppercase', color: 'var(--ink-light)' }}>
              Meeting Notes
            </span>
          </div>

          <button className="new-meeting-btn" onClick={() => setShowAddModal(true)}>
            + New Meeting
          </button>

          <div className="meeting-list">
            {meetings.map(m => (
              <button
                key={m.id}
                className={`meeting-item ${selectedMeeting?.id === m.id ? 'active' : ''}`}
                onClick={() => { setSelectedMeeting(m); setEditing(false) }}
              >
                <span className="meeting-item-date">{formatMeetingDate(m)}</span>
                <div className="meeting-item-row">
                  <span className={`meeting-author-chip ${m.updated_by === 'natalie' ? 'natalie' : 'grace'}`}>
                    {capitalize(m.updated_by || 'unknown')}
                  </span>
                  <span className="meeting-item-preview">
                    {m.content ? m.content.substring(0, 40) + (m.content.length > 40 ? '...' : '') : 'Empty'}
                  </span>
                </div>
              </button>
            ))}
            {meetings.length === 0 && (
              <p style={{ padding: 16, fontSize: 13, fontWeight: 300, color: 'var(--ink-light)' }}>No meetings yet</p>
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="meeting-detail">
          {!selectedMeeting ? (
            <div className="meeting-empty">
              <p style={{ fontSize: 13, fontWeight: 300, color: 'var(--ink-light)' }}>
                Select a meeting or create a new one
              </p>
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
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {!editing && (
                    <button onClick={startEdit} className="meeting-edit-btn">Edit</button>
                  )}
                  <button onClick={() => deleteMeeting(selectedMeeting.id)}
                    style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--ink-light)', padding: 4, lineHeight: 1, transition: 'color 0.2s' }}
                    onMouseEnter={e => e.target.style.color = '#B85450'}
                    onMouseLeave={e => e.target.style.color = 'var(--ink-light)'}
                  >&times;</button>
                </div>
              </div>

              <div className="meeting-divider" />

              {editing ? (
                <div className="meeting-content-edit">
                  <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    autoFocus
                    placeholder="What was discussed..."
                    className="meeting-textarea"
                  />
                  <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                    <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 400, color: 'var(--ink-light)' }}>
                      Cancel
                    </button>
                    <button onClick={saveEdit} className="meeting-save-btn">Save</button>
                  </div>
                </div>
              ) : (
                <div className="meeting-content">
                  {selectedMeeting.content || <span style={{ color: 'var(--ink-light)' }}>No notes yet.</span>}
                </div>
              )}
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
    const { data, error } = await supabase
      .from('notes')
      .insert([{ month: date, content: notes, updated_by: currentUser, updated_at: new Date().toISOString() }])
      .select()
      .single()
    if (!error && data) {
      setMeetings(prev => {
        if (prev.find(m => m.id === data.id)) return prev
        return [data, ...prev]
      })
      setSelectedMeeting(data)
      onClose()
    }
    setSaving(false)
  }

  return (
    <Modal onClose={onClose}>
      <div style={{ padding: 32, position: 'relative', maxWidth: 440 }}>
        <button onClick={onClose}
          style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', fontSize: 22, color: 'var(--ink-light)', lineHeight: 1, padding: 4, transition: 'color 0.2s' }}
          onMouseEnter={e => e.target.style.color = 'var(--ink)'}
          onMouseLeave={e => e.target.style.color = 'var(--ink-light)'}
        >&times;</button>

        <h2 style={{ fontSize: 14, fontWeight: 500, letterSpacing: 1, marginBottom: 28, color: 'var(--ink)' }}>New Meeting</h2>

        <div style={{ marginBottom: 24 }}>
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

        <div style={{ marginBottom: 32 }}>
          <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--ink-light)', display: 'block', marginBottom: 8 }}>Notes</span>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="What was discussed..."
            autoFocus
            style={{
              width: '100%', minHeight: 160, border: 'none',
              borderBottom: '1px solid var(--cream-deep)',
              outline: 'none', resize: 'none',
              fontFamily: 'Inter, sans-serif', fontSize: 14,
              fontWeight: 300, lineHeight: 1.8, color: 'var(--ink)',
              backgroundColor: 'transparent', marginTop: 8, padding: '8px 0',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, alignItems: 'center' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 400, color: 'var(--ink-light)' }}>Cancel</button>
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
