import { useState, useEffect, useRef } from 'react'
import { format, parseISO, subDays } from 'date-fns'
import { supabase, createChannel } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import DatePicker from '../components/DatePicker'
import SwipeToDelete from '../components/SwipeToDelete'
import RichEditor from '../components/RichEditor'
import Modal from '../components/Modal'
import './NotesPage.css'

function isTemplateMode(meeting) {
  if (!meeting?.content) return false
  try {
    const parsed = JSON.parse(meeting.content)
    // Detect template by _mode flag or by presence of template fields
    return parsed._mode === 'template' || parsed.goOver !== undefined
  } catch { return false }
}

function stripHtml(html) {
  if (!html) return ''
  // If template JSON, extract readable text from it
  try {
    const parsed = JSON.parse(html)
    if (parsed.goOver !== undefined) {
      const strip = (s) => s ? new DOMParser().parseFromString(s, 'text/html').body.textContent || '' : ''
      const parts = [strip(parsed.goOver)]
      if (parsed.natalieActions) parts.push(strip(parsed.natalieActions))
      if (parsed.graceActions) parts.push(strip(parsed.graceActions))
      if (parsed.natalieTodos?.length) parts.push(parsed.natalieTodos.map(t => t.text).join(', '))
      if (parsed.graceTodos?.length) parts.push(parsed.graceTodos.map(t => t.text).join(', '))
      const combined = parts.filter(Boolean).join(' ').trim()
      return combined || ''
    }
  } catch { /* not JSON, treat as HTML */ }
  return new DOMParser().parseFromString(html, 'text/html').body.textContent || ''
}

function generateSummary(text) {
  const plain = stripHtml(text).trim()
  if (!plain) return ''
  const filler = new Set(['the','a','an','and','or','to','in','on','at','of','for','is','it','be','as','by','we','i','was','were','that','this','with','from','have','has','had','not','but','are','do','does','did','will','would','can','could','should','just','also','so','if','then','our','my','your','their','its','all','each','both','been','being','get','got','us','me','he','she','they','who','what','when','where','how','which','than','very','too','more','most','here','there'])
  const months = new Set(['january','february','march','april','may','june','july','august','september','october','november','december','jan','feb','mar','apr','jun','jul','aug','sep','oct','nov','dec'])
  const datePattern = /^\d{1,4}(st|nd|rd|th)?[:\-\/]?$/i
  const words = plain.split(/\s+/).filter(w => {
    if (w.length <= 1) return false
    if (filler.has(w.toLowerCase())) return false
    if (months.has(w.toLowerCase().replace(/[^a-z]/g, ''))) return false
    if (datePattern.test(w)) return false
    return true
  })
  if (words.length === 0) return ''
  const summary = words.slice(0, 5)
  summary[0] = summary[0].charAt(0).toUpperCase() + summary[0].slice(1)
  return summary.join(' ')
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
  const selectedMeetingRef = useRef(null)

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
    selectedMeetingRef.current = selectedMeeting
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
      const meeting = selectedMeetingRef.current
      if (!meeting?.id) return
      const { error } = await supabase.from('notes').update({
        content: val,
        updated_at: new Date().toISOString(),
        updated_by: currentUser,
      }).eq('id', meeting.id)
      if (error) console.error('Failed to save:', error.message)
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
    // Store mode in content: template gets JSON wrapper, blank gets empty string
    const initialContent = mode === 'template'
      ? JSON.stringify({ _mode: 'template', goOver: '', natalieActions: '', graceActions: '', natalieTodos: [], graceTodos: [] })
      : ''
    // Insert to Supabase first, then set local state with the real ID
    const { data, error } = await supabase.from('notes').insert([{
      month: format(new Date(), 'yyyy-MM-dd'),
      content: initialContent,
      updated_by: currentUser,
      updated_at: new Date().toISOString(),
    }]).select().single()
    if (error) {
      console.error('Failed to save meeting:', error.message)
      return
    }
    if (data) {
      setMeetings(prev => [data, ...prev])
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
            {[...meetings].sort((a, b) => (b.month || '').localeCompare(a.month || '')).map(m => (
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
                      {m.title || generateSummary(m.content) || 'Empty'}
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
                  {/* Editable title */}
                  <input
                    className="meeting-title-input"
                    value={selectedMeeting.title || ''}
                    onChange={(e) => {
                      const title = e.target.value
                      setSelectedMeeting(prev => ({ ...prev, title }))
                      setMeetings(prev => prev.map(m => m.id === selectedMeeting.id ? { ...m, title } : m))
                    }}
                    onBlur={async () => {
                      await supabase.from('notes').update({ title: selectedMeeting.title || '' }).eq('id', selectedMeeting.id)
                    }}
                    placeholder="Name this meeting..."
                  />
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
                {isTemplateMode(selectedMeeting) ? (
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

function TemplateField({ field, html, onChange, placeholder }) {
  const ref = useRef(null)
  const isInternal = useRef(false)

  useEffect(() => {
    if (ref.current && !isInternal.current) {
      if (ref.current.innerHTML !== html) {
        ref.current.innerHTML = html || ''
      }
    }
    isInternal.current = false
  }, [html])

  const handleInput = () => {
    isInternal.current = true
    onChange(field, ref.current?.innerHTML || '')
  }

  const handleClick = (e) => {
    const li = e.target.closest?.('li')
    if (li && li.parentElement?.classList.contains('re-checklist')) {
      const rect = li.getBoundingClientRect()
      if (e.clientX < rect.left + 30) {
        e.preventDefault()
        li.classList.toggle('re-checked')
        handleInput()
      }
    }
  }

  const handleKeyDown = (e) => {
    // Enter on empty list item = exit the list (like Word)
    if (e.key === 'Enter' && !e.shiftKey) {
      const sel = window.getSelection()
      if (sel?.rangeCount > 0) {
        const li = sel.anchorNode?.closest?.('li') || sel.anchorNode?.parentElement?.closest?.('li')
        if (!li) return
        const text = li.textContent.replace(/\u200B/g, '').trim()
        if (text === '') {
          e.preventDefault()
          const ul = li.closest('ul, ol')
          li.remove()
          if (ul && ul.children.length === 0) ul.remove()
          const p = document.createElement('p')
          p.innerHTML = '<br>'
          if (ul && ul.parentNode) {
            ul.parentNode.insertBefore(p, ul.nextSibling)
          } else {
            ref.current.appendChild(p)
          }
          const range = document.createRange()
          range.setStart(p, 0)
          range.collapse(true)
          sel.removeAllRanges()
          sel.addRange(range)
          handleInput()
        }
      }
    }
  }

  const isEmpty = !html || html === '' || html === '<br>'

  return (
    <div className="template-field-wrap">
      <div
        ref={ref}
        className="template-editable"
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        spellCheck="true"
      />
      {isEmpty && <div className="template-editable-placeholder">{placeholder}</div>}
    </div>
  )
}

function TemplateToolbar() {
  const execCmd = (e, cmd, arg) => {
    e.preventDefault()
    document.execCommand(cmd, false, arg || null)
  }

  return (
    <div className="re-toolbar" style={{ marginBottom: 8 }}>
      <div className="re-toolbar-group">
        <button className="re-toolbar-btn" title="Bold (⌘B)" onMouseDown={e => execCmd(e, 'bold')} style={{ fontWeight: 700 }}>B</button>
        <button className="re-toolbar-btn" title="Italic (⌘I)" onMouseDown={e => execCmd(e, 'italic')} style={{ fontStyle: 'italic' }}>I</button>
        <button className="re-toolbar-btn" title="Underline (⌘U)" onMouseDown={e => execCmd(e, 'underline')} style={{ textDecoration: 'underline' }}>U</button>
        <button className="re-toolbar-btn" title="Strikethrough" onMouseDown={e => execCmd(e, 'strikeThrough')} style={{ textDecoration: 'line-through' }}>S</button>
      </div>
      <div className="re-toolbar-divider" />
      <div className="re-toolbar-group">
        <button className="re-toolbar-btn" title="Bullet list" onMouseDown={e => execCmd(e, 'insertUnorderedList')} style={{ fontSize: 18, lineHeight: 1 }}>&bull;</button>
        <button className="re-toolbar-btn" title="Numbered list" onMouseDown={e => execCmd(e, 'insertOrderedList')} style={{ fontSize: 11 }}>1.</button>
        <button className="re-toolbar-btn" title="Checklist" onMouseDown={e => {
          e.preventDefault()
          const sel = window.getSelection()
          const li = sel?.anchorNode?.closest?.('li') || sel?.anchorNode?.parentElement?.closest?.('li')
          const ul = li?.closest('ul')
          if (ul) {
            ul.classList.toggle('re-checklist')
          } else {
            document.execCommand('insertUnorderedList', false, null)
            // Find the last UL without checklist class in the active field
            const field = document.activeElement?.closest?.('.template-editable') || document.activeElement
            if (field) {
              const allUls = field.querySelectorAll('ul:not(.re-checklist)')
              if (allUls.length > 0) allUls[allUls.length - 1].classList.add('re-checklist')
            }
          }
        }} style={{ fontSize: 13, lineHeight: 1 }}>&#9745;</button>
      </div>
      <div className="re-toolbar-divider" />
      <div className="re-toolbar-group">
        <button className="re-toolbar-btn" title="Heading" onMouseDown={e => execCmd(e, 'formatBlock', '<h3>')} style={{ fontWeight: 600, fontSize: 11 }}>H</button>
        <button className="re-toolbar-btn" title="Normal text" onMouseDown={e => execCmd(e, 'formatBlock', '<p>')} style={{ fontSize: 10 }}>&para;</button>
      </div>
      <div className="re-toolbar-divider" />
      <div className="re-toolbar-group">
        <button className="re-toolbar-btn" title="Horizontal rule" onMouseDown={e => { e.preventDefault(); document.execCommand('insertHTML', false, '<hr style="border:none;border-top:1px solid #E8E0D5;margin:16px 0" />') }} style={{ fontSize: 10, letterSpacing: 2 }}>&mdash;</button>
        <button className="re-toolbar-btn" title="Clear formatting" onMouseDown={e => execCmd(e, 'removeFormat')} style={{ fontSize: 10 }}>&times;</button>
      </div>
    </div>
  )
}

function MeetingTemplate({ meeting, currentUser, onContentChange }) {
  const parseTemplate = (content) => {
    try {
      const parsed = JSON.parse(content)
      return {
        _mode: 'template',
        goOver: parsed.goOver || '',
        natalieActions: parsed.natalieActions || '',
        graceActions: parsed.graceActions || '',
        natalieTodos: parsed.natalieTodos || [],
        graceTodos: parsed.graceTodos || [],
      }
    } catch {
      return { _mode: 'template', goOver: '', natalieActions: '', graceActions: '', natalieTodos: [], graceTodos: [] }
    }
  }

  const dataRef = useRef(parseTemplate(meeting.content))
  const [data, setData] = useState(() => dataRef.current)
  const [natalieTodo, setNatalieTodo] = useState('')
  const [graceTodo, setGraceTodo] = useState('')

  useEffect(() => {
    const parsed = parseTemplate(meeting.content)
    dataRef.current = parsed
    setData(parsed)
  }, [meeting.id])

  const updateField = (field, value) => {
    const updated = { ...dataRef.current, [field]: value }
    dataRef.current = updated
    setData(updated)
    onContentChange(JSON.stringify(updated))
  }

  const addTodoItem = async (assignedTo, text) => {
    if (!text.trim()) return
    const month = format(new Date(), 'yyyy-MM-01')
    const todoText = text.trim()

    if (assignedTo === 'natalie') setNatalieTodo('')
    else setGraceTodo('')

    const listKey = assignedTo === 'natalie' ? 'natalieTodos' : 'graceTodos'
    const newItem = { text: todoText, id: crypto.randomUUID() }
    const updatedList = [...(dataRef.current[listKey] || []), newItem]
    const updated = { ...dataRef.current, [listKey]: updatedList }
    dataRef.current = updated
    setData(updated)
    onContentChange(JSON.stringify(updated))

    const { error } = await supabase
      .from('tasks')
      .insert({ title: todoText, assigned_to: assignedTo, month, status: 'todo' })
    if (error) console.error('Failed to save task:', error.message)
  }

  const removeTodoFromList = (assignedTo, index) => {
    const listKey = assignedTo === 'natalie' ? 'natalieTodos' : 'graceTodos'
    const updatedList = [...(dataRef.current[listKey] || [])]
    updatedList.splice(index, 1)
    const updated = { ...dataRef.current, [listKey]: updatedList }
    dataRef.current = updated
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
      <TemplateToolbar />

      <div className="template-section">
        <h3 className="template-section-title">Things to Go Over</h3>
        <TemplateField field="goOver" html={data.goOver} onChange={updateField} placeholder="Topics, questions, updates..." />
      </div>

      <div className="template-section">
        <h3 className="template-section-title">Action Items</h3>
        <div className="template-columns">
          <div className="template-col">
            <span className="template-col-label natalie-label">Natalie</span>
            <TemplateField field="natalieActions" html={data.natalieActions} onChange={updateField} placeholder="Action items..." />
          </div>
          <div className="template-col">
            <span className="template-col-label grace-label">Grace</span>
            <TemplateField field="graceActions" html={data.graceActions} onChange={updateField} placeholder="Action items..." />
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
