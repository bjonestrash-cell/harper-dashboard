import { useState, useEffect, useCallback, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useMonth } from '../hooks/useMonth'
import { useRealtime } from '../hooks/useRealtime'
import MonthSelector from '../components/MonthSelector'
import './NotesPage.css'

export default function NotesPage() {
  const { currentMonth, setCurrentMonth } = useMonth()
  const monthStr = format(currentMonth, 'yyyy-MM-01')
  const [content, setContent] = useState('')
  const [saveStatus, setSaveStatus] = useState('saved')
  const [lastEditor, setLastEditor] = useState(null)
  const [lastEditTime, setLastEditTime] = useState(null)
  const [quickNotes, setQuickNotes] = useState(() => {
    const saved = localStorage.getItem('harper-quick-notes')
    return saved ? JSON.parse(saved) : []
  })
  const [quickInput, setQuickInput] = useState('')
  const [isMobile] = useState(() => window.innerWidth < 768)
  const saveTimer = useRef(null)
  const currentUser = localStorage.getItem('harper-user') || 'natalie'

  const fetchAllNotes = useCallback(() =>
    supabase.from('notes').select('month, updated_at, updated_by').order('month', { ascending: false }),
    []
  )

  const { data: allNotes } = useRealtime('notes', fetchAllNotes)

  // Fetch current month note
  useEffect(() => {
    const fetchNote = async () => {
      const { data } = await supabase
        .from('notes').select('*').eq('month', monthStr).single()
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
  }, [monthStr])

  // Real-time subscription for notes
  useEffect(() => {
    const channel = supabase
      .channel(`notes-${monthStr}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'notes', filter: `month=eq.${monthStr}` },
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
  }, [monthStr, currentUser])

  // Auto-save
  const handleContentChange = (newContent) => {
    setContent(newContent)
    setSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        const { data: existing } = await supabase.from('notes').select('id').eq('month', monthStr).single()
        if (existing) {
          await supabase.from('notes').update({ content: newContent, updated_at: new Date().toISOString(), updated_by: currentUser }).eq('id', existing.id)
        } else {
          await supabase.from('notes').insert({ month: monthStr, content: newContent, updated_by: currentUser })
        }
        setSaveStatus('saved')
        setLastEditor(currentUser)
        setLastEditTime(new Date().toISOString())
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
    if (window.confirm('Clear all notes for this month?')) handleContentChange('')
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

  return (
    <div className="notes-page">
      <div className="page-header">
        <h1 className="page-title">Notes</h1>
      </div>

      <div className="page-container">
        {/* Mobile: month dropdown instead of sidebar */}
        {isMobile && <MonthSelector />}

        <div className="notes-layout">
          {/* Left panel */}
          {!isMobile && (
            <div className="notes-sidebar">
              <div className="notes-sidebar-header section-header">Months</div>
              <div className="month-list">
                {allNotes.map(note => (
                  <button key={note.month}
                    className={`month-list-item ${note.month === monthStr ? 'active' : ''}`}
                    onClick={() => setCurrentMonth(parseISO(note.month))}>
                    <span className="month-list-name">{format(parseISO(note.month), 'MMMM yyyy')}</span>
                    {note.updated_at && (
                      <span className="month-list-time caption">{format(parseISO(note.updated_at), 'MMM d, h:mm a')}</span>
                    )}
                  </button>
                ))}
                {allNotes.length === 0 && <p className="caption" style={{ padding: 16 }}>No notes yet</p>}
              </div>
            </div>
          )}

          {/* Center editor */}
          <div className="notes-editor-panel">
            <div className="notes-toolbar">
              <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: 4, textTransform: 'uppercase', color: 'var(--ink-light)' }}>
                {format(currentMonth, 'MMMM yyyy')}
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
              placeholder="Start writing..." />

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
