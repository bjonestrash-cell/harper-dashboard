import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import './FeedPage.css'

/*
  Supabase table:
  create table feed_posts (
    id uuid default gen_random_uuid() primary key,
    position int not null,
    image_url text,
    caption text,
    created_at timestamptz default now()
  );
*/

const GRID_SIZE = 12 // 3 columns × 4 rows
const STORAGE_KEY = 'harper-feed-grid'

// Persist to localStorage (works immediately, no DB needed)
function saveFeedLocal(slots) {
  try {
    const serializable = slots.map(s => s ? { id: s.id, position: s.position, image_url: s.image_url, caption: s.caption } : null)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable))
  } catch (e) { /* localStorage full — silently ignore */ }
}
function loadFeedLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {}
  return null
}

// Try Supabase, fall back gracefully
async function trySyncToSupabase(slots) {
  try {
    // Delete all then re-insert (simple sync)
    await supabase.from('feed_posts').delete().gte('position', 0)
    const rows = slots.filter(Boolean).map(s => ({
      position: s.position,
      image_url: s.image_url,
      caption: s.caption || '',
    }))
    if (rows.length > 0) await supabase.from('feed_posts').insert(rows)
  } catch (e) { /* table may not exist yet */ }
}

function EmptySlot({ index, onUpload }) {
  const inputRef = useRef(null)

  return (
    <button
      className="feed-slot feed-slot-empty"
      onClick={() => inputRef.current?.click()}
      title="Add photo"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) onUpload(index, file)
          e.target.value = ''
        }}
      />
      <div className="feed-slot-plus">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </div>
      <span className="feed-slot-label">{index + 1}</span>
    </button>
  )
}

function FilledSlot({ slot, index, onReplace, onRemove, onDragStart, onDragOver, onDrop, dragOver }) {
  const inputRef = useRef(null)
  const [showActions, setShowActions] = useState(false)

  return (
    <div
      className={`feed-slot feed-slot-filled ${dragOver ? 'drag-over' : ''}`}
      draggable
      onDragStart={e => onDragStart(e, index)}
      onDragOver={e => onDragOver(e, index)}
      onDrop={e => onDrop(e, index)}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={() => setShowActions(!showActions)}
    >
      <img
        src={slot.image_url}
        alt={slot.caption || `Feed position ${index + 1}`}
        className="feed-slot-image"
        draggable={false}
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) onReplace(index, file)
          e.target.value = ''
        }}
      />
      {showActions && (
        <div className="feed-slot-actions">
          <button
            className="feed-action-btn"
            onClick={e => { e.stopPropagation(); inputRef.current?.click() }}
            title="Replace photo"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </button>
          <button
            className="feed-action-btn feed-action-remove"
            onClick={e => { e.stopPropagation(); onRemove(index) }}
            title="Remove photo"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}
      <span className="feed-position-badge">{index + 1}</span>
    </div>
  )
}

export default function FeedPage() {
  const [slots, setSlots] = useState(() => {
    const local = loadFeedLocal()
    return local || Array(GRID_SIZE).fill(null)
  })
  const [saving, setSaving] = useState(false)
  const [dragIndex, setDragIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const currentUser = localStorage.getItem('harper-user') || 'natalie'

  // Also try loading from Supabase (merge if it has newer data)
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from('feed_posts')
          .select('*')
          .order('position', { ascending: true })
        if (data && data.length > 0) {
          const grid = Array(GRID_SIZE).fill(null)
          data.forEach(item => {
            if (item.position >= 0 && item.position < GRID_SIZE) grid[item.position] = item
          })
          setSlots(grid)
          saveFeedLocal(grid)
        }
      } catch (e) { /* table may not exist */ }
    }
    load()
  }, [])

  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    // Resize to 540x675 (half of 1080x1350) for storage efficiency
    const img = new Image()
    const reader = new FileReader()
    reader.onload = e => {
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 540
        canvas.height = 675
        const ctx = canvas.getContext('2d')
        // Cover fit — crop to 4:5
        const srcRatio = img.width / img.height
        const tgtRatio = 4 / 5
        let sw, sh, sx, sy
        if (srcRatio > tgtRatio) {
          sh = img.height
          sw = sh * tgtRatio
          sx = (img.width - sw) / 2
          sy = 0
        } else {
          sw = img.width
          sh = sw / tgtRatio
          sx = 0
          sy = (img.height - sh) / 2
        }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 540, 675)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  // Helper to update slots + persist
  const updateSlots = useCallback((updater) => {
    setSlots(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      saveFeedLocal(next)
      trySyncToSupabase(next) // fire-and-forget
      return next
    })
  }, [])

  const handleUpload = useCallback(async (position, file) => {
    setSaving(true)
    try {
      const dataUrl = await fileToDataUrl(file)
      const newSlot = { id: crypto.randomUUID(), position, image_url: dataUrl, caption: '' }
      updateSlots(prev => {
        const next = [...prev]
        next[position] = newSlot
        return next
      })
    } catch (err) {
      console.error('Upload failed:', err)
    }
    setSaving(false)
  }, [updateSlots])

  const handleReplace = useCallback(async (position, file) => {
    setSaving(true)
    try {
      const dataUrl = await fileToDataUrl(file)
      updateSlots(prev => {
        const next = [...prev]
        const existing = next[position]
        next[position] = { ...(existing || {}), id: existing?.id || crypto.randomUUID(), position, image_url: dataUrl }
        return next
      })
    } catch (err) {
      console.error('Replace failed:', err)
    }
    setSaving(false)
  }, [updateSlots])

  const handleRemove = useCallback((position) => {
    updateSlots(prev => {
      const next = [...prev]
      next[position] = null
      return next
    })
  }, [updateSlots])

  // Drag and drop reordering
  const handleDragStart = (e, index) => {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDrop = useCallback((e, toIndex) => {
    e.preventDefault()
    setDragOverIndex(null)
    if (dragIndex === null || dragIndex === toIndex) return

    updateSlots(prev => {
      const next = [...prev]
      const fromSlot = next[dragIndex]
      const toSlot = next[toIndex]
      // Swap positions
      if (fromSlot) fromSlot.position = toIndex
      if (toSlot) toSlot.position = dragIndex
      next[toIndex] = fromSlot
      next[dragIndex] = toSlot
      return next
    })

    setDragIndex(null)
  }, [dragIndex, updateSlots])

  const filledCount = slots.filter(Boolean).length

  return (
    <div className="feed-page page-animate">
      <PageHeader title="Feed Planner">
        <div className="feed-header-meta">
          <span className="feed-counter">{filledCount} / {GRID_SIZE}</span>
          {saving && <span className="feed-saving">Saving...</span>}
        </div>
      </PageHeader>

      <div className="page-container">
        {/* Natalie's personal note */}
        <div className="feed-intro">
          <span className="feed-intro-label">Natalie's Instagram Grid</span>
          <span className="feed-intro-sub">Drag to reorder. Tap to add or replace. 4:5 ratio auto-cropped.</span>
        </div>

        {/* Instagram-style phone frame */}
        <div className="feed-frame">
          {/* Fake IG profile header */}
          <div className="feed-ig-header">
            <div className="feed-ig-avatar">
              <span className="feed-ig-avatar-text">HARPER</span>
            </div>
            <div className="feed-ig-stats">
              <div className="feed-ig-stat">
                <strong>757</strong>
                <span>posts</span>
              </div>
              <div className="feed-ig-stat">
                <strong>28.7K</strong>
                <span>followers</span>
              </div>
              <div className="feed-ig-stat">
                <strong>265</strong>
                <span>following</span>
              </div>
            </div>
          </div>
          <div className="feed-ig-name">
            <strong>Harper Jewelry</strong>
            <span className="feed-ig-handle">@harperjewelry</span>
            <span className="feed-ig-category">Jewelry/watches</span>
            <span>Where luxury meets affordability</span>
            <span className="feed-ig-features">Featured in @voguemagazine & @glamourmag</span>
          </div>

          {/* The 3×4 grid */}
          <div className="feed-grid">
            {slots.map((slot, i) => (
              slot ? (
                <FilledSlot
                  key={slot.id || i}
                  slot={slot}
                  index={i}
                  onReplace={handleReplace}
                  onRemove={handleRemove}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  dragOver={dragOverIndex === i}
                />
              ) : (
                <EmptySlot key={i} index={i} onUpload={handleUpload} />
              )
            ))}
          </div>
        </div>

        <div className="forme-footer">powered by forme</div>
      </div>
    </div>
  )
}
