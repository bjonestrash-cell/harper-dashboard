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

const MIN_GRID = 12 // start with 4 rows
const STORAGE_KEY = 'harper-feed-grid'
const FEED_SYNC_KEY = '9999-01-01'

// Ensure grid size is always a multiple of 3 and at least MIN_GRID
function ensureGridSize(slots) {
  // Check if top row (first 3 slots) has any filled slot
  const topRowFilled = slots[0] || slots[1] || slots[2]
  if (topRowFilled) {
    // Add a new empty row at the top (3 slots)
    const newSlots = [null, null, null, ...slots]
    // Update all positions
    return newSlots.map((s, i) => s ? { ...s, position: i } : null)
  }
  return slots
}

function saveFeedLocal(slots) {
  try {
    const serializable = slots.map(s => s ? { id: s.id, position: s.position, image_url: s.image_url, caption: s.caption } : null)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable))
  } catch (e) {}
}
function loadFeedLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // Ensure minimum size
      while (parsed.length < MIN_GRID) parsed.push(null)
      return parsed
    }
  } catch (e) {}
  return null
}

// Sync feed via the existing 'notes' table
async function syncFeedToSupabase(slots) {
  try {
    const serializable = slots.map(s => s ? { position: s.position, image_url: s.image_url, caption: s.caption } : null)
    const content = JSON.stringify(serializable)

    // Use upsert pattern — check with maybeSingle to avoid .single() throwing
    const { data: existing } = await supabase
      .from('notes')
      .select('id')
      .eq('month', FEED_SYNC_KEY)
      .maybeSingle()

    if (existing) {
      await supabase.from('notes')
        .update({ content, updated_at: new Date().toISOString(), updated_by: 'feed' })
        .eq('id', existing.id)
    } else {
      await supabase.from('notes')
        .insert([{ month: FEED_SYNC_KEY, content, updated_by: 'feed' }])
    }
  } catch (e) {
    console.warn('Feed sync failed:', e.message)
  }
}

async function loadFeedFromSupabase() {
  try {
    const { data } = await supabase
      .from('notes')
      .select('content')
      .eq('month', FEED_SYNC_KEY)
      .maybeSingle()
    if (data?.content) {
      const parsed = JSON.parse(data.content)
      while (parsed.length < MIN_GRID) parsed.push(null)
      return parsed
    }
  } catch (e) {}
  return null
}

function EmptySlot({ index, onUpload, onDragOver, onDrop, dragOver, onFileDrop }) {
  const inputRef = useRef(null)

  const handleDrop = (e) => {
    e.preventDefault()
    // Check if external file is being dropped
    const files = e.dataTransfer?.files
    if (files && files.length > 0 && files[0].type.startsWith('image/')) {
      onFileDrop?.(index, files[0])
      return
    }
    // Otherwise it's an internal reorder
    onDrop?.(e, index)
  }

  return (
    <button
      className={`feed-slot feed-slot-empty ${dragOver ? 'drag-over' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; onDragOver?.(e, index) }}
      onDrop={handleDrop}
      onDragLeave={() => onDragOver?.(null, -1)}
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

function FilledSlot({ slot, index, onReplace, onRemove, onDragStart, onDragOver, onDrop, dragOver, onTouchDragStart, onTouchDragMove, onTouchDragEnd, isBeingDragged, onFileDrop }) {
  const inputRef = useRef(null)
  const [showActions, setShowActions] = useState(false)
  const longPressTimer = useRef(null)
  const isDragging = useRef(false)

  const handleFileDrop = (e) => {
    e.preventDefault()
    const files = e.dataTransfer?.files
    if (files && files.length > 0 && files[0].type.startsWith('image/')) {
      onFileDrop?.(index, files[0])
      return
    }
    onDrop(e, index)
  }

  const handleTouchStart = (e) => {
    // Long press to start drag on mobile
    longPressTimer.current = setTimeout(() => {
      isDragging.current = true
      setShowActions(false)
      onTouchDragStart?.(index)
      // Vibrate if available
      navigator.vibrate?.(30)
    }, 300)
  }

  const handleTouchMove = (e) => {
    if (isDragging.current) {
      e.preventDefault()
      const touch = e.touches[0]
      onTouchDragMove?.(touch.clientX, touch.clientY)
    } else {
      // Cancel long press if finger moves
      clearTimeout(longPressTimer.current)
    }
  }

  const handleTouchEnd = (e) => {
    clearTimeout(longPressTimer.current)
    if (isDragging.current) {
      isDragging.current = false
      const touch = e.changedTouches[0]
      onTouchDragEnd?.(touch.clientX, touch.clientY)
    }
  }

  return (
    <div
      className={`feed-slot feed-slot-filled ${dragOver ? 'drag-over' : ''} ${isBeingDragged ? 'is-dragging' : ''}`}
      draggable
      onDragStart={e => onDragStart(e, index)}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; onDragOver(e, index) }}
      onDrop={handleFileDrop}
      onDragLeave={() => setShowActions(false)}
      onDragEnd={() => setShowActions(false)}
      onMouseEnter={() => !isDragging.current && setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      data-index={index}
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
      {showActions && !isBeingDragged && (
        <div className="feed-slot-actions" onClick={e => e.stopPropagation()}>
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
    if (!local) return Array(MIN_GRID).fill(null)
    while (local.length < MIN_GRID) local.push(null)
    return local
  })
  const [saving, setSaving] = useState(false)
  const [dragIndex, setDragIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [touchDragIndex, setTouchDragIndex] = useState(null)
  const gridRef = useRef(null)
  const currentUser = localStorage.getItem('harper-user') || 'natalie'

  // Load from Supabase on mount (cross-device sync)
  useEffect(() => {
    const load = async () => {
      const remote = await loadFeedFromSupabase()
      const local = loadFeedLocal()
      const localHasData = local && local.some(s => s !== null)
      const remoteHasData = remote && remote.some(s => s !== null)

      if (remoteHasData) {
        // Remote has data — use it (cross-device sync)
        while (remote.length < MIN_GRID) remote.push(null)
        setSlots(remote)
        saveFeedLocal(remote)
      } else if (localHasData) {
        // Local has data but remote doesn't — push local to Supabase
        // This handles the case where someone uploaded before sync was deployed
        syncFeedToSupabase(local)
      }
    }
    load()

    // Real-time subscription for cross-device updates
    const channel = supabase
      .channel('feed-sync')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'notes', filter: `month=eq.${FEED_SYNC_KEY}` },
        async (payload) => {
          if (payload.new?.content && payload.new?.updated_by === 'feed') {
            try {
              const remote = JSON.parse(payload.new.content)
              while (remote.length < MIN_GRID) remote.push(null)
              setSlots(remote)
              saveFeedLocal(remote)
            } catch (e) {}
          }
        }
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
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

  // Helper to update slots + persist + auto-grow
  const updateSlots = useCallback((updater) => {
    setSlots(prev => {
      let next = typeof updater === 'function' ? updater(prev) : updater
      // Auto-grow: if top row (first 3 slots) has any filled slot, add empty row above
      next = ensureGridSize(next)
      while (next.length < MIN_GRID) next.push(null)
      saveFeedLocal(next)
      syncFeedToSupabase(next)
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

  // Touch drag for mobile
  const handleTouchDragStart = useCallback((index) => {
    setTouchDragIndex(index)
    setDragOverIndex(null)
  }, [])

  const handleTouchDragMove = useCallback((x, y) => {
    if (!gridRef.current) return
    // Find which slot we're over
    const els = gridRef.current.querySelectorAll('.feed-slot')
    for (let i = 0; i < els.length; i++) {
      const rect = els[i].getBoundingClientRect()
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        setDragOverIndex(i)
        return
      }
    }
    setDragOverIndex(null)
  }, [])

  const handleTouchDragEnd = useCallback((x, y) => {
    if (touchDragIndex === null) return
    if (!gridRef.current) { setTouchDragIndex(null); return }

    // Find drop target
    const els = gridRef.current.querySelectorAll('.feed-slot')
    let dropIndex = null
    for (let i = 0; i < els.length; i++) {
      const rect = els[i].getBoundingClientRect()
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        dropIndex = i
        break
      }
    }

    if (dropIndex !== null && dropIndex !== touchDragIndex) {
      updateSlots(prev => {
        const next = [...prev]
        const fromSlot = next[touchDragIndex]
        const toSlot = next[dropIndex]
        if (fromSlot) fromSlot.position = dropIndex
        if (toSlot) toSlot.position = touchDragIndex
        next[dropIndex] = fromSlot
        next[touchDragIndex] = toSlot
        return next
      })
    }

    setTouchDragIndex(null)
    setDragOverIndex(null)
  }, [touchDragIndex, updateSlots])

  const filledCount = slots.filter(Boolean).length

  return (
    <div className="feed-page page-animate">
      <PageHeader title="Feed Planner">
        <div className="feed-header-meta">
          <span className="feed-counter">{filledCount} / {slots.length}</span>
          {saving && <span className="feed-saving">Saving...</span>}
        </div>
      </PageHeader>

      <div className="page-container">
        <div className="feed-intro">
          <span className="feed-intro-sub">Tap to add. Hold and drag to reorder. Auto-cropped to 4:5.</span>
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
          <div className="feed-grid" ref={gridRef}>
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
                  onTouchDragStart={handleTouchDragStart}
                  onTouchDragMove={handleTouchDragMove}
                  onTouchDragEnd={handleTouchDragEnd}
                  isBeingDragged={touchDragIndex === i}
                  onFileDrop={handleReplace}
                />
              ) : (
                <EmptySlot
                  key={i}
                  index={i}
                  onUpload={handleUpload}
                  onDragOver={handleDragOver}
                  onFileDrop={handleUpload}
                  onDrop={handleDrop}
                  dragOver={dragOverIndex === i}
                />
              )
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
