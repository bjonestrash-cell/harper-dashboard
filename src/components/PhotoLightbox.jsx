import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { nextCaptions } from '../lib/feedCaptions'
import './PhotoLightbox.css'

function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).catch(() => legacyCopy(text))
  }
  return Promise.resolve(legacyCopy(text))
}

function legacyCopy(text) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  try { document.execCommand('copy') } catch (e) {}
  ta.remove()
}

export default function PhotoLightbox({ slot, position, onClose, onReplace, onRemove }) {
  const [captions, setCaptions] = useState(null)
  const [copiedKey, setCopiedKey] = useState(null)
  const fileInputRef = useRef(null)
  const copyTimer = useRef(null)
  const rotatedOnce = useRef(false)

  // Pull the next 5 captions from the rotation exactly once per open (the ref
  // guard keeps StrictMode's double-mounted effect from advancing it twice)
  useEffect(() => {
    if (rotatedOnce.current) return
    rotatedOnce.current = true
    setCaptions(nextCaptions())
  }, [])

  // Lock body scroll + close on Escape
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      clearTimeout(copyTimer.current)
    }
  }, [onClose])

  const handleCopy = (text, key) => {
    copyToClipboard(text).then(() => {
      setCopiedKey(key)
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopiedKey(null), 1600)
    })
  }

  const handleDownload = async () => {
    const filename = `harper-feed-${position + 1}.jpg`
    // Prefer the native share sheet on mobile — lets you "Save Image" straight
    // to the camera roll on iPhone.
    try {
      const blob = await (await fetch(slot.image_url)).blob()
      const file = new File([blob], filename, { type: blob.type || 'image/jpeg' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
        return
      }
    } catch (e) {
      if (e?.name === 'AbortError') return // user closed the share sheet
    }
    const a = document.createElement('a')
    a.href = slot.image_url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return createPortal(
    <div className="lightbox-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Feed photo ${position + 1}`}>
      <div className="lightbox-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-topbar">
          <span className="lightbox-slot-label">Slot {position + 1}</span>
          <div className="lightbox-topbar-actions">
            <button
              className="lightbox-icon-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Replace photo"
              aria-label="Replace photo"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </button>
            <button
              className="lightbox-icon-btn lightbox-icon-remove"
              onClick={() => { onRemove(position); onClose() }}
              title="Remove photo"
              aria-label="Remove photo"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </button>
            <button className="lightbox-icon-btn" onClick={onClose} title="Close" aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) { onReplace(position, file); onClose() }
              e.target.value = ''
            }}
          />
        </div>

        <div className="lightbox-image-wrap">
          <img src={slot.image_url} alt={`Feed position ${position + 1}`} className="lightbox-image" draggable={false} />
        </div>

        <div className="lightbox-body">
          <button className="lightbox-download-btn" onClick={handleDownload}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Save photo
          </button>

          <div className="lightbox-section">
            <div className="lightbox-section-head">
              <span className="lightbox-section-title">✨ Caption ideas</span>
              <button className="lightbox-refresh-btn" onClick={() => setCaptions(nextCaptions())}>
                More ideas
              </button>
            </div>

            <ul className="lightbox-caption-list">
              {(captions || []).map((caption, i) => (
                <li key={`${caption}-${i}`} className="lightbox-caption">
                  <p className="lightbox-caption-text">{caption}</p>
                  <button
                    className={`lightbox-copy-btn ${copiedKey === `c${i}` ? 'copied' : ''}`}
                    onClick={() => handleCopy(caption, `c${i}`)}
                  >
                    {copiedKey === `c${i}` ? 'Copied ✓' : 'Copy'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
