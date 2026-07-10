import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase, createChannel } from '../lib/supabase'
import { logAudit } from '../lib/audit'
import { fetchVaultPhotos, vaultPhotos, isVaulted, vaultWritesInFlight } from '../lib/feedVault'
import PageHeader from '../components/PageHeader'
import PhotoLightbox from '../components/PhotoLightbox'
import './FeedPage.css'

/*
  Persistence:
  - Photo data lives in the photo vault (src/lib/feedVault.js): one small,
    insert-only row per photo. The app never updates or deletes vault rows,
    so every photo ever added stays recoverable forever.
  - Grid layout lives in the ORDER_SYNC_KEY notes row: just photo ids in
    slot order plus the ids people explicitly removed. Tiny, written on
    every change, so edits save instantly and survive refresh.
  - The PHOTOS_SYNC_KEY notes row is the LEGACY store (all photos inside one
    ~6MB row). It is still read and merged from — so nothing an old client
    saves is ever lost — but never written: updating it had started hitting
    Postgres statement timeouts, which is how changes were getting lost.
  Any stored photo not referenced by the order row (and not explicitly
  removed) is appended to the grid, never dropped.
*/

const MIN_GRID = 12 // start with 4 rows
const STORAGE_KEY = 'harper-feed-grid'
const PHOTOS_SYNC_KEY = '9999-01-01'
const ORDER_SYNC_KEY = '9999-01-02'

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

function serializePhotos(slots) {
  return slots.map(s => s ? { id: s.id, position: s.position, image_url: s.image_url, caption: s.caption } : null)
}

// Ids of photos a person explicitly removed (kept in the order row so every
// device knows). Distinguishes "deliberately deleted" from "missing because
// a stale device overwrote the row" — only the former may drop a photo.
const removedPhotoIds = new Set()

function serializeOrder(slots) {
  return {
    order: slots.map(s => s ? s.id || null : null),
    removed: [...removedPhotoIds].slice(-300),
  }
}

// Order row content: legacy plain array, or { order, removed }
function parseOrderContent(content) {
  if (Array.isArray(content)) return { order: content, removed: [] }
  if (content && Array.isArray(content.order)) {
    return { order: content.order, removed: Array.isArray(content.removed) ? content.removed : [] }
  }
  return null
}

// ---- Reliable, serialized writes to the 'notes' sync rows ----
// One write in flight per row; newer content replaces anything still queued
// (last-write-wins), failed writes retry, and callers can observe how many
// writes are outstanding (for the Saving indicator + close-tab warning).
const noteRowIds = {}
const writeQueues = {}
let activeWrites = 0
const writeListeners = new Set()
const notifyWriteListeners = () => writeListeners.forEach(fn => fn(activeWrites))

async function writeNoteRow(month, content) {
  if (!noteRowIds[month]) {
    const { data, error } = await supabase
      .from('notes')
      .select('id')
      .eq('month', month)
      .maybeSingle()
    if (error) throw error
    if (data) noteRowIds[month] = data.id
  }
  if (noteRowIds[month]) {
    const { error } = await supabase.from('notes')
      .update({ content, updated_at: new Date().toISOString(), updated_by: 'feed' })
      .eq('id', noteRowIds[month])
    if (error) throw error
  } else {
    const { error } = await supabase.from('notes')
      .insert([{ month, content, updated_by: 'feed' }])
    if (error) throw error
  }
}

function queueNoteWrite(month, content, onError) {
  const q = writeQueues[month] || (writeQueues[month] = { pending: null, running: false })
  q.pending = { content, onError }
  if (q.running) return
  q.running = true
  activeWrites++
  notifyWriteListeners()
  ;(async () => {
    while (q.pending) {
      const job = q.pending
      q.pending = null
      let done = false
      for (let attempt = 0; attempt < 3 && !done; attempt++) {
        try {
          await writeNoteRow(month, job.content)
          done = true
        } catch (e) {
          console.warn('Feed sync attempt failed:', month, e.message)
          if (q.pending) break // newer content queued — write that instead
          await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
        }
      }
      if (!done && !q.pending) job.onError?.()
    }
    q.running = false
    activeWrites--
    notifyWriteListeners()
  })()
}

// Returns { ok, content } so callers can tell "row is empty" apart from
// "fetch failed" — we must never treat a failed fetch as an empty feed.
// Retries with backoff: the database occasionally cancels big reads under
// load ("statement timeout").
async function fetchNoteContent(month, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('content')
        .eq('month', month)
        .maybeSingle()
      if (error) throw error
      return { ok: true, content: data?.content ? JSON.parse(data.content) : null }
    } catch (e) {
      console.warn('Feed load failed:', month, e.message)
      if (i < attempts - 1) await new Promise(r => setTimeout(r, 1000 * (i + 1)))
    }
  }
  return { ok: false, content: null }
}

// Trim trailing empty rows, pad to MIN_GRID, keep an empty top row, reindex.
function normalizeGrid(arr) {
  let lastFilled = -1
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i]) { lastFilled = i; break }
  }
  let end = lastFilled === -1 ? MIN_GRID : Math.ceil((lastFilled + 1) / 3) * 3
  if (end < MIN_GRID) end = MIN_GRID
  let out = arr.slice(0, end)
  while (out.length < MIN_GRID) out.push(null)
  out = ensureGridSize(out)
  return out.map((s, i) => s ? { ...s, position: i } : null)
}

function ensureIds(slots) {
  let added = false
  const out = slots.map(s => {
    if (!s) return null
    if (s.id) return s
    added = true
    return { ...s, id: crypto.randomUUID() }
  })
  return { slots: out, added }
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

function FilledSlot({ slot, index, onOpen, onReplace, onRemove, onDragStart, onDragOver, onDrop, dragOver, onTouchDragStart, onTouchDragMove, onTouchDragEnd, isBeingDragged, onFileDrop }) {
  const inputRef = useRef(null)
  const slotRef = useRef(null)
  const [showActions, setShowActions] = useState(false)
  const longPressTimer = useRef(null)
  const isDragging = useRef(false)
  const touchStartPos = useRef(null)
  // A tap opens the lightbox, but a hold-drag must never — the browser can
  // fire a synthetic click after touchend, so suppress it when a drag ran.
  const suppressClick = useRef(false)

  const handleFileDrop = (e) => {
    e.preventDefault()
    const files = e.dataTransfer?.files
    if (files && files.length > 0 && files[0].type.startsWith('image/')) {
      onFileDrop?.(index, files[0])
      return
    }
    onDrop(e, index)
  }

  // Attach touchmove with { passive: false } so preventDefault() actually works
  useEffect(() => {
    const el = slotRef.current
    if (!el) return

    const onTouchMove = (e) => {
      if (isDragging.current) {
        e.preventDefault()
        const touch = e.touches[0]
        onTouchDragMove?.(touch.clientX, touch.clientY)
      } else {
        // Cancel long press if finger moves more than 10px (it's a scroll)
        if (touchStartPos.current) {
          const touch = e.touches[0]
          const dx = Math.abs(touch.clientX - touchStartPos.current.x)
          const dy = Math.abs(touch.clientY - touchStartPos.current.y)
          if (dx > 10 || dy > 10) {
            clearTimeout(longPressTimer.current)
          }
        }
      }
    }

    el.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => el.removeEventListener('touchmove', onTouchMove)
  }, [onTouchDragMove])

  const handleTouchStart = (e) => {
    const touch = e.touches[0]
    touchStartPos.current = { x: touch.clientX, y: touch.clientY }
    // Long press to start drag on mobile
    longPressTimer.current = setTimeout(() => {
      isDragging.current = true
      suppressClick.current = true
      setShowActions(false)
      onTouchDragStart?.(index)
      navigator.vibrate?.(30)
    }, 300)
  }

  const handleTouchEnd = (e) => {
    clearTimeout(longPressTimer.current)
    touchStartPos.current = null
    if (isDragging.current) {
      isDragging.current = false
      const touch = e.changedTouches[0]
      onTouchDragEnd?.(touch.clientX, touch.clientY)
      // Swallow the synthetic click the browser may fire after this touchend
      setTimeout(() => { suppressClick.current = false }, 500)
    }
  }

  const handleClick = () => {
    if (suppressClick.current || isDragging.current) return
    onOpen?.(index)
  }

  return (
    <div
      ref={slotRef}
      className={`feed-slot feed-slot-filled ${dragOver ? 'drag-over' : ''} ${isBeingDragged ? 'is-dragging' : ''}`}
      draggable
      onClick={handleClick}
      onDragStart={e => { suppressClick.current = true; onDragStart(e, index) }}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; onDragOver(e, index) }}
      onDrop={handleFileDrop}
      onDragLeave={() => setShowActions(false)}
      onDragEnd={() => { setShowActions(false); setTimeout(() => { suppressClick.current = false }, 300) }}
      onContextMenu={e => e.preventDefault()}
      onMouseEnter={() => !isDragging.current && setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onTouchStart={handleTouchStart}
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
    if (!local) return Array(MIN_GRID).fill(null)
    while (local.length < MIN_GRID) local.push(null)
    return ensureGridSize(local)
  })
  const [saving, setSaving] = useState(false)
  const [writeCount, setWriteCount] = useState(0)
  const [syncError, setSyncError] = useState(false)
  const [dragIndex, setDragIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [touchDragIndex, setTouchDragIndex] = useState(null)
  const [ghostPos, setGhostPos] = useState(null)
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const gridRef = useRef(null)
  const slotsRef = useRef(slots)
  const pendingPersistRef = useRef(null)
  const currentUser = localStorage.getItem('harper-user') || 'natalie'

  useEffect(() => { slotsRef.current = slots }, [slots])

  // Save to Supabase: the tiny order row, plus vault copies of any photos
  // not yet vaulted (re-offered every time, so failed vault writes
  // self-heal). Failures surface via the syncError banner.
  const [vaultBusy, setVaultBusy] = useState(false)
  const persistSlots = useCallback((slotsToSave) => {
    saveFeedLocal(slotsToSave)
    setSyncError(false)
    queueNoteWrite(ORDER_SYNC_KEY, JSON.stringify(serializeOrder(slotsToSave)), () => setSyncError(true))
    const unvaulted = slotsToSave.filter(s => s && s.id && s.image_url && !isVaulted(s.id))
    if (unvaulted.length) {
      setVaultBusy(true)
      vaultPhotos(unvaulted)
        .catch(() => setSyncError(true))
        .finally(() => setVaultBusy(false))
    }
  }, [])

  // Show "Saving..." while writes are outstanding, and warn before the tab
  // closes mid-save so a refresh can't silently discard a change.
  useEffect(() => {
    const onWrites = (n) => setWriteCount(n)
    writeListeners.add(onWrites)
    const onBeforeUnload = (e) => {
      if (activeWrites > 0 || vaultWritesInFlight() > 0) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      writeListeners.delete(onWrites)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [])

  // Load from Supabase on mount (cross-device sync).
  // Assemble the grid from: order row (layout) + vault (photo data) +
  // legacy row (photo data saved by older clients), then rescue anything
  // stored but unreferenced. Nothing readable is ever dropped.
  useEffect(() => {
    const assembleGrid = (parsedOrder, photoMap, fallbackOrder) => {
      const orderArr = parsedOrder ? parsedOrder.order : (fallbackOrder || [])
      const used = new Set()
      const grid = orderArr.map(id => {
        if (id && photoMap.has(id) && !used.has(id)) {
          used.add(id)
          return { ...photoMap.get(id) }
        }
        return null
      })
      // Rescue: stored photos nobody explicitly removed always get a slot
      for (const [id, p] of photoMap) {
        if (!used.has(id) && !removedPhotoIds.has(id)) grid.push({ ...p })
      }
      return { grid: normalizeGrid(grid), rescuedCount: grid.filter(Boolean).length - used.size }
    }

    // Read the legacy giant row and fold unknown photos into the map.
    // Returns its slot layout (used as order fallback for first-ever run).
    const foldInLegacy = async (photoMap) => {
      const legacyRes = await fetchNoteContent(PHOTOS_SYNC_KEY)
      if (!Array.isArray(legacyRes.content)) return { ok: legacyRes.ok, order: null }
      const { slots: withIds } = ensureIds(legacyRes.content)
      withIds.forEach(s => {
        if (s && s.image_url && !photoMap.has(s.id)) {
          photoMap.set(s.id, { id: s.id, image_url: s.image_url, caption: s.caption || '' })
        }
      })
      return { ok: true, order: withIds.map(s => s ? s.id : null) }
    }

    const load = async () => {
      const [orderRes, vaultMap] = await Promise.all([
        fetchNoteContent(ORDER_SYNC_KEY),
        fetchVaultPhotos(),
      ])
      const parsedOrder = parseOrderContent(orderRes.content)
      parsedOrder?.removed.forEach(id => removedPhotoIds.add(id))
      const photoMap = vaultMap ? new Map(vaultMap) : new Map()

      // Targeted lookup for any ordered photo the primary vault didn't have
      if (parsedOrder) {
        const missing = parsedOrder.order.filter(id => id && !photoMap.has(id))
        if (missing.length) {
          const extra = await fetchVaultPhotos(missing)
          extra?.forEach((p, id) => photoMap.set(id, p))
        }
      }

      // First paint from the fast reads alone — the legacy giant row is
      // slow and timeout-prone, so it must never delay the grid.
      let painted = null
      if (parsedOrder && photoMap.size > 0) {
        const { grid, rescuedCount } = assembleGrid(parsedOrder, photoMap, null)
        painted = grid
        setSlots(grid)
        saveFeedLocal(grid)
        // Insurance backfill: offer everything to the vault (deduped there)
        vaultPhotos(grid.filter(Boolean)).catch(() => {})
        if (rescuedCount > 0) persistSlots(grid)
      }

      // Fold in the legacy row afterwards — it can only ADD photos (ones
      // saved by an old client that nothing else knows about).
      const legacy = await foldInLegacy(photoMap)

      if (photoMap.size > 0) {
        const { grid, rescuedCount } = assembleGrid(parsedOrder, photoMap, legacy.order)
        const changed = !painted ||
          JSON.stringify(serializePhotos(grid)) !== JSON.stringify(serializePhotos(painted))
        if (changed) {
          setSlots(grid)
          saveFeedLocal(grid)
          vaultPhotos(grid.filter(Boolean)).catch(() => {})
          if (!parsedOrder || rescuedCount > 0) persistSlots(grid)
        }
      } else if (legacy.ok && orderRes.ok) {
        // Everything readable and genuinely empty — push local up if we have it
        const local = loadFeedLocal()
        if (local && local.some(Boolean)) {
          const { slots: withIds } = ensureIds(local)
          const grid = normalizeGrid(withIds)
          setSlots(grid)
          persistSlots(grid)
        }
      }
      // Otherwise: fetches failed — keep the local paint, never wipe
    }
    load()

    // Real-time: when another device changes the order row (every edit
    // touches it), rebuild the grid, fetching only photos we don't have.
    // The legacy row subscription catches uploads from not-yet-refreshed
    // old clients.
    const onRemoteChange = async () => {
      if (activeWrites > 0 || vaultWritesInFlight() > 0) return // our own echo
      const orderRes = await fetchNoteContent(ORDER_SYNC_KEY)
      const parsedOrder = parseOrderContent(orderRes.content)
      if (!parsedOrder) return
      parsedOrder.removed.forEach(id => removedPhotoIds.add(id))

      const photoMap = new Map(slotsRef.current.filter(Boolean).map(s => [s.id, s]))
      const missing = parsedOrder.order.filter(id => id && !photoMap.has(id))
      if (missing.length) {
        const fetched = await fetchVaultPhotos(missing)
        fetched?.forEach((p, id) => photoMap.set(id, p))
        if (!fetched || missing.some(id => !photoMap.has(id))) await foldInLegacy(photoMap)
      }
      const { grid } = assembleGrid(parsedOrder, photoMap, null)
      setSlots(prev => {
        if (JSON.stringify(serializePhotos(prev)) === JSON.stringify(serializePhotos(grid))) return prev
        saveFeedLocal(grid)
        return grid
      })
    }
    const channel = createChannel('feed-sync')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'notes', filter: `month=eq.${PHOTOS_SYNC_KEY}` },
        onRemoteChange)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'notes', filter: `month=eq.${ORDER_SYNC_KEY}` },
        onRemoteChange)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [persistSlots])

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

  // Helper to update slots + persist + auto-grow. State updaters must stay
  // pure, so the persist is handed off via ref and flushed in the effect below.
  const updateSlots = useCallback((updater) => {
    setSlots(prev => {
      let next = typeof updater === 'function' ? updater(prev) : updater
      // Auto-grow: if top row (first 3 slots) has any filled slot, add empty row above
      next = ensureGridSize(next)
      while (next.length < MIN_GRID) next.push(null)
      pendingPersistRef.current = { slots: next }
      return next
    })
  }, [])

  useEffect(() => {
    const pending = pendingPersistRef.current
    if (!pending) return
    pendingPersistRef.current = null
    persistSlots(pending.slots)
  }, [slots, persistSlots])

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
      logAudit({ table: 'feed', action: 'insert', recordId: newSlot.id, summary: `Added feed photo at slot ${position + 1}` })
    } catch (err) {
      console.error('Upload failed:', err)
    }
    setSaving(false)
  }, [updateSlots])

  const handleReplace = useCallback(async (position, file) => {
    setSaving(true)
    try {
      const dataUrl = await fileToDataUrl(file)
      // A replacement is a new photo: new id, so the old photo's vault copy
      // stays untouched and the new one gets its own.
      const newSlot = { id: crypto.randomUUID(), position, image_url: dataUrl, caption: '' }
      updateSlots(prev => {
        const next = [...prev]
        const existing = next[position]
        if (existing?.id) removedPhotoIds.add(existing.id)
        next[position] = { ...newSlot, caption: existing?.caption || '' }
        return next
      })
      logAudit({ table: 'feed', action: 'update', recordId: newSlot.id, summary: `Replaced feed photo at slot ${position + 1}` })
    } catch (err) {
      console.error('Replace failed:', err)
    }
    setSaving(false)
  }, [updateSlots])

  const handleRemove = useCallback((position) => {
    const removed = slotsRef.current[position]
    if (removed?.id) {
      removedPhotoIds.add(removed.id)
      logAudit({ table: 'feed', action: 'delete', recordId: removed.id, summary: `Removed feed photo from slot ${position + 1} (vault copy kept)` })
    }
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
      // Swap (copies — never mutate previous state)
      const fromSlot = next[dragIndex] ? { ...next[dragIndex], position: toIndex } : null
      const toSlot = next[toIndex] ? { ...next[toIndex], position: dragIndex } : null
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
    setGhostPos({ x, y })
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
        const fromSlot = next[touchDragIndex] ? { ...next[touchDragIndex], position: dropIndex } : null
        const toSlot = next[dropIndex] ? { ...next[dropIndex], position: touchDragIndex } : null
        next[dropIndex] = fromSlot
        next[touchDragIndex] = toSlot
        return next
      })
    }

    setTouchDragIndex(null)
    setDragOverIndex(null)
    setGhostPos(null)
  }, [touchDragIndex, updateSlots])

  const openLightbox = useCallback((index) => setLightboxIndex(index), [])
  const closeLightbox = useCallback(() => setLightboxIndex(null), [])

  const filledCount = slots.filter(Boolean).length

  return (
    <div className="feed-page page-animate">
      <PageHeader title="Feed Planner">
        <div className="feed-header-meta">
          <span className="feed-counter">{filledCount} / {slots.length}</span>
          {(saving || writeCount > 0 || vaultBusy) && !syncError && <span className="feed-saving">Saving...</span>}
          {syncError && (
            <button
              className="feed-sync-error"
              onClick={() => persistSlots(slotsRef.current)}
              title="The last change couldn't be saved. Tap to try again."
            >
              Not saved — retry
            </button>
          )}
        </div>
      </PageHeader>

      <div className="page-container">
        <div className="feed-intro">
          <span className="feed-intro-sub">Tap a photo for caption ideas & saving. Hold and drag to reorder. Auto-cropped to 4:5.</span>
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
                  onOpen={openLightbox}
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

        {/* Floating ghost for touch drag — portaled to body to avoid transform offset */}
        {touchDragIndex !== null && ghostPos && slots[touchDragIndex] && createPortal(
          <div
            className="feed-drag-ghost"
            style={{
              left: ghostPos.x,
              top: ghostPos.y,
            }}
          >
            <img
              src={slots[touchDragIndex].image_url}
              alt=""
              draggable={false}
            />
          </div>,
          document.body
        )}

        {/* Tap-to-enlarge lightbox: save photo + rotating caption ideas */}
        {lightboxIndex !== null && slots[lightboxIndex] && (
          <PhotoLightbox
            slot={slots[lightboxIndex]}
            position={lightboxIndex}
            onClose={closeLightbox}
            onReplace={handleReplace}
            onRemove={handleRemove}
          />
        )}

      </div>
    </div>
  )
}
