import { useState, useEffect, useCallback, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import './NotesPage.css'

export default function NotesPage() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [content, setContent] = useState('')
  const [saveStatus, setSaveStatus] = useState('saved')
  const [lastEditor, setLastEditor] = useState(null)
  const [lastEditTime, setLastEditTime] = useState(null)
  const [recentDates, setRecentDates] = useState([])
  const [quickNotes, setQuickNotes] = useState(() => {
    const saved = localStorage.getItem('harper-quick-notes')
    return saved ? JSON.parse(saved) : []
  })
  const [quickInput, setQuickInput] = useState('')
  const [isMobile] = useState(() => window.innerWidth < 768)
  const saveTimer = useRef(null)
  const currentUser = localStorage.getItem('harper-user') || 'natalie'

  // Fetch recent meeting dates
  useEffect(() => {
    const fetchRecent = async () => {
      const { data } = await supabase
        .from('notes')
        .select('month, updated_at, updated_by, content')
        .order('month', { ascending: false })
        .limit(20)
      if (data) setRecentDates(data)
    }
    fetchRecent()
  }, [])

  // Fetch note for selected date
  useEffect(() => {
    const fetchNote = async () => {
      // Try by date first, fall back to month
      const { data } = await supabase
        .from('notes')
        .select('*')
        .eq('month', selectedDate)
        .single()
      if (data) {
        setContent(data.content || '')
        setLastEditor(data.updated_by)
        setLastEditTime(data.updated_at)
      } else {
        setContent('')
        setLastEditor(null)
        setLastEditTime(null)
      }
    }
    fetchNote()
  }, [selectedDate])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`notes-${selectedDate}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'notes', filter: `month=eq.${selectedDate}` },
        (payload) => {
          if (payload.new && payload.new.updated_by !== currentUser) {
            setContent(payload.new.content || '')
            setLastEditor(payload.new.updated_by)
            setLastEditTime(payload.new.updated_at)
          }
        }
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [selectedDate, currentUser])

  // Auto-save
  const handleContentChange = (newContent) => {
    setContent(newContent)
    setSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        const { data: existing } = await supabase.from('notes').select('id').eq('month', selectedDate).single()
        if (existing) {
          await supabase.from('notes').update({ content: newContent, updated_at: new Date().toISOString(), updated_by: currentUser }).eq('id', existing.id)
        } else {
          await supabase.from('notes').insert({ month: selectedDate, content: newContent, updated_by: currentUser })
        }
        setSaveStatus('saved')
        setLastEditor(currentUser)
        setLastEditTime(new Date().toISOString())
        // Refresh recent dates
        const { data } = await supabase.from('notes').select('month, updated_at, updated_by, content').order('month', { ascending: false }).limit(20)
        if (data) setRecentDates(data)
      } catch (err) {
        console.error('Error saving note:', err)
        setSaveStatus('error')
      }
    }, 2000)
  }

  // Quick notes
  const addQuickNote = () => {
    const text = quickInput.trim()
    if (!text) return
    const updated = [...quickNotes, { id: Date.now(), text }]
    setQuickNotes(updated)
    localStorage.setItem('harper-quick-notes', JSON.stringify(updated))
    setQuickInput('')
  }

  const removeQuickNote = (id) => {
    const updated = quickNotes.filter(n => n.id !== id)
    setQuickNotes(updated)
    localStorage.setItem('harper-quick-notes', JSON.stringify(updated))
  }

  const handleClear = () => {
    if (window.confirm('Clear all notes for this date?')) handleContentChange('')
  }

  const applyFormat = (type) => {
    const textarea = document.getElementById('notes-editor')
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = content.slice(start, end)
    let newText = content
    switch (type) {
      case 'bold': newText = content.slice(0, start) + `**${selected}**` + content.slice(end); break
      case 'italic': newText = content.slice(0, start) + `_${selected}_` + content.slice(end); break
      case 'bullet': newText = content.slice(0, start) + `\n- ${selected}` + content.slice(end); break
    }
    handleContentChange(newText)
  }

  const handleNewMeeting = () => {
    setSelectedDate(format(new Date(), 'yyyy-MM-dd'))
    setContent('')
  }

  const dateLabel = selectedDate ? format(parseISO(selectedDate), 'EEEE, MMMM d yyyy') : ''

  return (
    <div className="notes-page">
      <div className="page-header">
        <h1 className="page-title">Meeting Notes</h1>
      </div>

      <div className="page-container">
        {/* Date selector */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32,
          paddingBottom: 20, borderBottom: '1px solid var(--cream-deep)', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--ink-light)' }}>
            Meeting Date
          </span>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={{
              border: 'none', borderBottom: '1px solid var(--cream-deep)', background: 'transparent',
              fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 300, color: 'var(--ink)',
              outline: 'none', padding: '4px 0',
            }}
          />
          <select
            onChange={e => { if (e.target.value) setSelectedDate(e.target.value) }}
            value=""
            style={{
              border: 'none', borderBottom: '1px solid var(--cream-deep)', background: 'transparent',
              fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 400, letterSpacing: 1,
              color: 'var(--ink-light)', outline: 'none', padding: '4px 0', appearance: 'none',
            }}
          >
            <option value="">Recent meetings...</option>
            {recentDates.map(d => (
              <option key={d.month} value={d.month}>
                {format(parseISO(d.month), 'MMM d, yyyy')}
              </option>
            ))}
          </select>
        </div>

        <div className="notes-layout">
          {/* Left panel — Recent meetings */}
          {!isMobile && (
            <div className="notes-sidebar">
              <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--cream-deep)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="section-header">Recent</span>
                <button onClick={handleNewMeeting} style={{ fontSize: 10, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--pink-deep)' }}>
                  + New
                </button>
              </div>
              <div className="month-list">
                {recentDates.map(note => (
                  <button key={note.month}
                    className={`month-list-item ${note.month === selectedDate ? 'active' : ''}`}
                    onClick={() => setSelectedDate(note.month)}>
                    <span className="month-list-name">{format(parseISO(note.month), 'MMM d, yyyy')}</span>
                    <span className="month-list-time caption" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {note.content ? note.content.substring(0, 30) + (note.content.length > 30 ? '...' : '') : 'Empty'}
                    </span>
                  </button>
                ))}
                {recentDates.length === 0 && <p className="caption" style={{ padding: 16 }}>No meetings yet</p>}
              </div>
            </div>
          )}

          {/* Center editor */}
          <div className="notes-editor-panel">
            <div className="notes-toolbar">
              <span style={{ fontSize: 18, fontWeight: 300, letterSpacing: 1, color: 'var(--ink)' }}>
                {dateLabel}
              </span>
              <div className="toolbar-actions">
                <button className="toolbar-btn" onClick={() => applyFormat('bold')} title="Bold">B</button>
                <button className="toolbar-btn" style={{ fontStyle: 'italic' }} onClick={() => applyFormat('italic')} title="Italic">I</button>
                <button className="toolbar-btn" onClick={() => applyFormat('bullet')} title="Bullet list">&bull;</button>
                <button className="toolbar-btn clear-btn" onClick={handleClear}>Clear</button>
              </div>
              <span className={`save-indicator ${saveStatus}`}>
                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'error' ? 'Error' : 'Saved'}
              </span>
            </div>

            <textarea id="notes-editor" className="notes-textarea"
              value={content} onChange={(e) => handleContentChange(e.target.value)}
              placeholder="Start writing meeting notes..." />

            {lastEditor && lastEditTime && (
              <div className="last-edited caption">
                Last edited by {lastEditor} at {format(parseISO(lastEditTime), 'h:mm a, MMM d')}
              </div>
            )}
          </div>

          {/* Right quick notes */}
          {!isMobile && (
            <div className="quick-notes-panel">
              <div className="quick-notes-header section-header">Quick Notes</div>
              <div className="quick-notes-list">
                {quickNotes.map(note => (
                  <div key={note.id} className="quick-note">
                    <span className="quick-note-text">{note.text}</span>
                    <button className="quick-note-delete" onClick={() => removeQuickNote(note.id)}>x</button>
                  </div>
                ))}
              </div>
              <div className="quick-note-input">
                <input placeholder="Add a note..." value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addQuickNote()} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
