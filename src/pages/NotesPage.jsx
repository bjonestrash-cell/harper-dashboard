import { useState, useEffect, useRef } from 'react'
import { format, parseISO, subDays } from 'date-fns'
import { supabase, createChannel } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import DatePicker from '../components/DatePicker'
import SwipeToDelete from '../components/SwipeToDelete'
import RichEditor from '../components/RichEditor'
import Modal from '../components/Modal'
import './NotesPage.css'

function stripHtml(html) {
  if (!html) return ''
  // If template JSON, extract readable text from it
  try {
    const parsed = JSON.parse(html)
    if (parsed.goOver !== undefined) {
      const parts = [parsed.goOver]
      if (parsed.natalieActions) parts.push(parsed.natalieActions)
      if (parsed.graceActions) parts.push(parsed.graceActions)
      if (parsed.natalieTodos?.length) parts.push(parsed.natalieTodos.map(t => t.text).join(', '))
      if (parsed.graceTodos?.length) parts.push(parsed.graceTodos.map(t => t.text).join(', '))
      const combined = parts.filter(Boolean).join(' ').trim()
      return combined || ''
    }
  } catch { /* not JSON, treat as HTML */ }
  return new DOMParser().parseFromString(html, 'text/html').body.textContent || ''
}

async function generateSummary(text) {
  const plain = stripHtml(text).trim()
  if (!plain) return ''
  // Extract first two meaningful words as a quick summary
  const words = plain.split(/\s+/).filter(w => w.length > 1)
  if (words.length === 0) return ''
  return words.slice(0, 2).join(' ')
}

export default function NotesPage() {
  const currentUser = localStorage.getItem('harper-user') || 'natalie'
  const [meetings, setMeetings] = useState([])
  const [selectedMeeting, setSelectedMeeting] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saveStatus, setSaveStatus] = useState('saved')
  const [editingDate, setEditingDate] = useState(false)
  const [showNewChoice, setShowNewChoice] = useState(false)
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
      setEditingDate(false)
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
      const summary = await generateSummary(val)
      await supabase.from('notes').update({
        content: val,
        summary,
        updated_at: new Date().toISOString(),
        updated_by: currentUser,
      }).eq('id', selectedMeeting.id)
      // Update local state with summary
      setMeetings(prev => prev.map(m => m.id === selectedMeeting.id ? { ...m, summary } : m))
      setSaveStatus('saved')
    }, 2000)
  }

  const handleDateChange = async (newDate) => {
    if (!newDate || !selectedMeeting) return
    if (newDate === selectedMeeting.month) return
    const updated = { ...selectedMeeting, month: newDate }
    setSelectedMeeting(updated)
    setMeetings(prev => prev.map(m => m.id === updated.id ? updated : m))
    await supabase.from('notes').update({
      month: newDate,
      updated_at: new Date().toISOString(),
    }).eq('id', selectedMeeting.id)
  }

  const formatMeetingDate = (m) => {
    try { return format(parseISO(m.month), 'EEE, MMM d') } catch { return m.month }
  }

  const formatMeetingDateFull = (m) => {
    try { return format(parseISO(m.month), 'EEEE, MMMM d yyyy') } catch { return m.month }
  }

  const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : ''

  const createNewMeeting = async (mode = 'blank') => {
    setShowNewChoice(false)
    const newMeeting = {
      id: crypto.randomUUID(),
      month: format(new Date(), 'yyyy-MM-dd'),
      content: '',
      meeting_mode: mode,
      updated_by: currentUser,
      updated_at: new Date().toISOString(),
    }
    setMeetings(prev => [newMeeting, ...prev])
    setSelectedMeeting(newMeeting)
    const { data } = await supabase.from('notes').insert([{
      month: newMeeting.month, content: '', meeting_mode: mode, updated_by: currentUser, updated_at: newMeeting.updated_at
    }]).select().single()
    if (data) {
      setMeetings(prev => prev.map(m => m.id === newMeeting.id ? data : m))
      setSelectedMeeting(data)
    }
  }

  return (
    <div className="notes-page">
      <PageHeader title="Meeting Notes" />
      <div className="meeting-layout">
        {/* LEFT PANEL */}
        <div className="meeting-sidebar">
          <div className="meeting-sidebar-header" />

          <button className="new-meeting-btn" onClick={() => setShowNewChoice(true)}>
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
                      {m.summary || stripHtml(m.content) || 'Empty'}
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

        {/* CENTER: NOTE DETAIL */}
        <div className="meeting-detail">
          {!selectedMeeting ? (
            <div className="meeting-empty" style={{ flexDirection: 'column', gap: 0 }}>
              <button
                onClick={() => setShowNewChoice(true)}
                style={{
                  backgroundColor: 'var(--ink)', color: 'var(--cream)', border: 'none',
                  borderRadius: 9999, padding: '10px 28px', fontSize: 11, fontWeight: 500,
                  letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'Inter, sans-serif',
                  cursor: 'pointer',
                }}
              >Start Writing</button>
            </div>
          ) : (
            <>
              <div className="meeting-detail-header">
                <div>
                  {/* Editable date — click to open calendar picker */}
                  <div style={{ position: 'relative' }}>
                    <h2
                      className="meeting-date-display"
                      onClick={() => setEditingDate(!editingDate)}
                      title="Click to edit date"
                    >
                      {formatMeetingDateFull(selectedMeeting)}
                      <span className="meeting-date-edit-hint">&#9998;</span>
                    </h2>
                    {editingDate && (
                      <DatePicker
                        value={selectedMeeting.month}
                        onChange={(val) => handleDateChange(val)}
                        isOpen={true}
                        onClose={() => setEditingDate(false)}
                        persistOpen
                      />
                    )}
                  </div>
                  <span className={`meeting-author-chip ${selectedMeeting.updated_by === 'natalie' ? 'natalie' : 'grace'}`}>
                    by {capitalize(selectedMeeting.updated_by || 'unknown')}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
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
                      background: 'none', border: 'none', fontSize: 11, cursor: 'pointer',
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
                      background: 'none', border: 'none', fontSize: 11, cursor: 'pointer',
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
                {selectedMeeting.meeting_mode === 'template' ? (
                  <MeetingTemplate
                    meeting={selectedMeeting}
                    currentUser={currentUser}
                    onContentChange={handleContentChange}
                    saveStatus={saveStatus}
                  />
                ) : (
                  <RichEditor
                    content={editContent}
                    onChange={handleContentChange}
                    placeholder="Start typing your meeting notes..."
                  />
                )}
              </div>
            </>
          )}
        </div>

      </div>

      {/* New Meeting Choice Modal */}
      {showNewChoice && (
        <Modal onClose={() => setShowNewChoice(false)}>
          <div className="new-choice-modal">
            <h2 style={{ fontSize: 14, fontWeight: 500, letterSpacing: 1, marginBottom: 8, color: 'var(--ink)' }}>New Meeting</h2>
            <p style={{ fontSize: 12, fontWeight: 300, color: 'var(--ink-light)', marginBottom: 28 }}>
              How would you like to start?
            </p>
            <div style={{ display: 'flex', gap: 16 }}>
              <button
                className="new-choice-btn"
                onClick={() => createNewMeeting('template')}
              >
                <span className="new-choice-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <path d="M3 9h18M9 3v18"/>
                  </svg>
                </span>
                <span className="new-choice-label">Template</span>
                <span className="new-choice-desc">Structured meeting sheet</span>
              </button>
              <button
                className="new-choice-btn"
                onClick={() => createNewMeeting('blank')}
              >
                <span className="new-choice-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/>
                    <path d="M14 3v4h4"/>
                    <path d="M8 13h8M8 17h5"/>
                  </svg>
                </span>
                <span className="new-choice-label">Blank</span>
                <span className="new-choice-desc">Free-form rich text</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

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

function MeetingTemplate({ meeting, currentUser, onContentChange }) {
  const parseTemplate = (content) => {
    try {
      const parsed = JSON.parse(content)
      return {
        goOver: parsed.goOver || '',
        natalieActions: parsed.natalieActions || '',
        graceActions: parsed.graceActions || '',
        natalieTodos: parsed.natalieTodos || [],
        graceTodos: parsed.graceTodos || [],
      }
    } catch {
      return { goOver: '', natalieActions: '', graceActions: '', natalieTodos: [], graceTodos: [] }
    }
  }

  const [data, setData] = useState(() => parseTemplate(meeting.content))
  const [natalieTodo, setNatalieTodo] = useState('')
  const [graceTodo, setGraceTodo] = useState('')

  useEffect(() => {
    setData(parseTemplate(meeting.content))
  }, [meeting.id])

  const updateField = (field, value) => {
    const updated = { ...data, [field]: value }
    setData(updated)
    onContentChange(JSON.stringify(updated))
  }

  const addTodoItem = async (assignedTo, text) => {
    if (!text.trim()) return
    const month = format(new Date(), 'yyyy-MM-01')
    const todoText = text.trim()

    // Save to Supabase todos table (same shape as TasksPage)
    const { data: saved, error } = await supabase
      .from('todos')
      .insert({ text: todoText, month, assigned_to: assignedTo, priority: 'normal' })
      .select()
      .single()

    if (error) {
      console.error('Failed to save todo:', error.message)
    }

    // Add to template's visible list and persist in note content
    const listKey = assignedTo === 'natalie' ? 'natalieTodos' : 'graceTodos'
    const newItem = { text: todoText, id: saved?.id || crypto.randomUUID(), added: true }
    const updatedList = [...(data[listKey] || []), newItem]
    const updated = { ...data, [listKey]: updatedList }
    setData(updated)
    onContentChange(JSON.stringify(updated))

    if (assignedTo === 'natalie') setNatalieTodo('')
    else setGraceTodo('')
  }

  const removeTodoFromList = (assignedTo, index) => {
    const listKey = assignedTo === 'natalie' ? 'natalieTodos' : 'graceTodos'
    const updatedList = [...(data[listKey] || [])]
    updatedList.splice(index, 1)
    const updated = { ...data, [listKey]: updatedList }
    setData(updated)
    onContentChange(JSON.stringify(updated))
  }

  const renderTodoColumn = (assignedTo, inputVal, setInputVal, label, labelClass) => {
    const listKey = assignedTo === 'natalie' ? 'natalieTodos' : 'graceTodos'
    const items = data[listKey] || []

    return (
      <div className="template-col">
        <span className={`template-col-label ${labelClass}`}>{label}</span>
        <div className="template-todo-list">
          {items.map((item, i) => (
            <div key={item.id || i} className="template-todo-item">
              <span className="template-todo-check">&#10003;</span>
              <span className="template-todo-text">{item.text}</span>
              <button
                className="template-todo-remove"
                onClick={() => removeTodoFromList(assignedTo, i)}
                title="Remove"
              >&times;</button>
            </div>
          ))}
          <div className="template-todo-input-row">
            <input
              className="template-todo-input"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              placeholder="New to-do..."
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTodoItem(assignedTo, inputVal) } }}
            />
            <button
              className="template-todo-add"
              onClick={() => addTodoItem(assignedTo, inputVal)}
              title="Add to-do"
            >+</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="meeting-template">
      <div className="template-section">
        <h3 className="template-section-title">Things to Go Over</h3>
        <textarea
          className="template-textarea full-width"
          value={data.goOver || ''}
          onChange={e => updateField('goOver', e.target.value)}
          placeholder="Topics, questions, updates..."
        />
      </div>

      <div className="template-section">
        <h3 className="template-section-title">Action Items</h3>
        <div className="template-columns">
          <div className="template-col">
            <span className="template-col-label natalie-label">Natalie</span>
            <textarea
              className="template-textarea"
              value={data.natalieActions || ''}
              onChange={e => updateField('natalieActions', e.target.value)}
              placeholder="Action items..."
            />
          </div>
          <div className="template-col">
            <span className="template-col-label grace-label">Grace</span>
            <textarea
              className="template-textarea"
              value={data.graceActions || ''}
              onChange={e => updateField('graceActions', e.target.value)}
              placeholder="Action items..."
            />
          </div>
        </div>
      </div>

      <div className="template-section">
        <h3 className="template-section-title">Add to To-Do List</h3>
        <div className="template-columns">
          {renderTodoColumn('natalie', natalieTodo, setNatalieTodo, 'Natalie', 'natalie-label')}
          {renderTodoColumn('grace', graceTodo, setGraceTodo, 'Grace', 'grace-label')}
        </div>
      </div>
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
    } catch {
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
          style={{ position: 'absolute', top: 24, right: 24, background: 'none', border: 'none', fontSize: 22, color: 'var(--ink-light)', lineHeight: 1, padding: 4, transition: 'color 0.2s', cursor: 'pointer' }}
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
                  fontFamily: 'Inter, sans-serif', cursor: 'pointer',
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
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--ink-light)', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleDone} disabled={saving}
            style={{
              backgroundColor: 'var(--ink)', color: 'var(--cream)',
              border: 'none', padding: '12px 32px', fontSize: 11,
              fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase',
              transition: 'background 0.2s ease', cursor: 'pointer',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--pink-deep)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--ink)'}
          >{saving ? 'Saving...' : 'Done'}</button>
        </div>
      </div>
    </Modal>
  )
}
