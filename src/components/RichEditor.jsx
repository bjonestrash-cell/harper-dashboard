import { useState, useRef, useEffect, useCallback } from 'react'
import './RichEditor.css'

const EMOJIS = [
  // Favorites / reactions
  '🤍', '💕', '✨', '💎', '🪩', '🫶', '💅', '🌸', '🦋', '☁️',
  '🔥', '💫', '⭐', '🌙', '🤎', '💛', '🩷', '💜', '🖤', '🤍',
  // Objects
  '📌', '📝', '📎', '🗓️', '📊', '📈', '💡', '🎯', '🏷️', '📦',
  '💌', '🎁', '🛍️', '💍', '📸', '🎬', '🎨', '✏️', '🖊️', '📋',
  // Expressions
  '👏', '🙌', '💪', '🤞', '✅', '❌', '⚡', '🚀', '👀', '💬',
  // Nature
  '🌿', '🌺', '🌷', '🌻', '🍂', '☀️', '🌈', '❄️', '🌊', '🍃',
]

function ToolbarBtn({ label, title, command, arg, style, active, editorRef }) {
  const handleClick = (e) => {
    e.preventDefault()
    editorRef.current?.focus()
    document.execCommand(command, false, arg || null)
  }

  return (
    <button
      title={title}
      onMouseDown={handleClick}
      className={`re-toolbar-btn ${active ? 're-btn-active' : ''}`}
      style={style}
    >{label}</button>
  )
}

export default function RichEditor({ content, onChange, placeholder }) {
  const editorRef = useRef(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [activeFormats, setActiveFormats] = useState({})
  const isInternalChange = useRef(false)
  const emojiRef = useRef(null)

  // Initialize editor with content
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== content) {
        editorRef.current.innerHTML = content || ''
      }
    }
    isInternalChange.current = false
  }, [content])

  // Track active formatting
  const updateActiveFormats = useCallback(() => {
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      insertOrderedList: document.queryCommandState('insertOrderedList'),
    })
  }, [])

  const handleInput = () => {
    isInternalChange.current = true
    onChange(editorRef.current?.innerHTML || '')
    updateActiveFormats()
  }

  const handleKeyUp = () => updateActiveFormats()
  const handleMouseUp = () => updateActiveFormats()

  // Keyboard shortcuts
  const handleKeyDown = (e) => {
    if (e.metaKey || e.ctrlKey) {
      switch (e.key) {
        case 'b': e.preventDefault(); document.execCommand('bold'); break
        case 'i': e.preventDefault(); document.execCommand('italic'); break
        case 'u': e.preventDefault(); document.execCommand('underline'); break
      }
    }
    // Tab for indent
    if (e.key === 'Tab') {
      e.preventDefault()
      document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;')
    }
  }

  // Save cursor position before emoji picker opens
  const savedRange = useRef(null)
  const saveCursorPosition = () => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      savedRange.current = sel.getRangeAt(0).cloneRange()
    }
  }

  const insertEmoji = (emoji) => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    // Restore saved cursor position
    if (savedRange.current) {
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(savedRange.current)
    }
    document.execCommand('insertText', false, emoji)
    savedRange.current = null
    setShowEmoji(false)
  }

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmoji) return
    const handleClick = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) {
        setShowEmoji(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showEmoji])

  const handlePaste = (e) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/html') || e.clipboardData.getData('text/plain')
    if (e.clipboardData.getData('text/html')) {
      // Clean pasted HTML - keep basic formatting only
      const temp = document.createElement('div')
      temp.innerHTML = text
      // Remove scripts, styles, etc
      temp.querySelectorAll('script,style,meta,link').forEach(el => el.remove())
      document.execCommand('insertHTML', false, temp.innerHTML)
    } else {
      document.execCommand('insertText', false, text)
    }
  }

  const isEmpty = !content || content === '' || content === '<br>'

  return (
    <div className="rich-editor">
      {/* Toolbar */}
      <div className="re-toolbar">
        <div className="re-toolbar-group">
          <ToolbarBtn label="B" title="Bold (⌘B)" command="bold"
            active={activeFormats.bold} editorRef={editorRef}
            style={{ fontWeight: 700 }} />
          <ToolbarBtn label="I" title="Italic (⌘I)" command="italic"
            active={activeFormats.italic} editorRef={editorRef}
            style={{ fontStyle: 'italic' }} />
          <ToolbarBtn label="U" title="Underline (⌘U)" command="underline"
            active={activeFormats.underline} editorRef={editorRef}
            style={{ textDecoration: 'underline' }} />
          <ToolbarBtn label="S" title="Strikethrough" command="strikeThrough"
            active={activeFormats.strikeThrough} editorRef={editorRef}
            style={{ textDecoration: 'line-through' }} />
        </div>

        <div className="re-toolbar-divider" />

        <div className="re-toolbar-group">
          <ToolbarBtn label="•" title="Bullet list" command="insertUnorderedList"
            active={activeFormats.insertUnorderedList} editorRef={editorRef}
            style={{ fontSize: 18, lineHeight: 1 }} />
          <ToolbarBtn label="1." title="Numbered list" command="insertOrderedList"
            active={activeFormats.insertOrderedList} editorRef={editorRef}
            style={{ fontSize: 11 }} />
        </div>

        <div className="re-toolbar-divider" />

        <div className="re-toolbar-group">
          <button
            className="re-toolbar-btn"
            title="Heading"
            onMouseDown={e => {
              e.preventDefault()
              editorRef.current?.focus()
              document.execCommand('formatBlock', false, '<h3>')
            }}
            style={{ fontWeight: 600, fontSize: 11 }}
          >H</button>
          <button
            className="re-toolbar-btn"
            title="Normal text"
            onMouseDown={e => {
              e.preventDefault()
              editorRef.current?.focus()
              document.execCommand('formatBlock', false, '<p>')
            }}
            style={{ fontSize: 10 }}
          >¶</button>
        </div>

        <div className="re-toolbar-divider" />

        <div className="re-toolbar-group" ref={emojiRef} style={{ position: 'relative' }}>
          <button
            className={`re-toolbar-btn re-emoji-trigger ${showEmoji ? 're-btn-active' : ''}`}
            onMouseDown={e => { e.preventDefault(); setShowEmoji(!showEmoji) }}
            title="Emoji"
          >☺</button>

          {showEmoji && (
            <div className="re-emoji-picker">
              <div className="re-emoji-grid">
                {EMOJIS.map((emoji, i) => (
                  <button
                    key={i}
                    className="re-emoji-btn"
                    onClick={() => insertEmoji(emoji)}
                  >{emoji}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="re-toolbar-divider" />

        <div className="re-toolbar-group">
          <button
            className="re-toolbar-btn"
            title="Horizontal rule"
            onMouseDown={e => {
              e.preventDefault()
              editorRef.current?.focus()
              document.execCommand('insertHTML', false, '<hr style="border:none;border-top:1px solid #E8E0D5;margin:16px 0" />')
            }}
            style={{ fontSize: 10, letterSpacing: 2 }}
          >—</button>
          <button
            className="re-toolbar-btn"
            title="Clear formatting"
            onMouseDown={e => {
              e.preventDefault()
              editorRef.current?.focus()
              document.execCommand('removeFormat')
            }}
            style={{ fontSize: 10 }}
          >✕</button>
        </div>
      </div>

      {/* Editor area */}
      <div className="re-editor-wrap">
        <div
          ref={editorRef}
          className="re-editor"
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onMouseUp={handleMouseUp}
          onPaste={handlePaste}
          spellCheck="true"
          data-placeholder={placeholder}
        />
        {isEmpty && (
          <div className="re-placeholder">{placeholder}</div>
        )}
      </div>
    </div>
  )
}
