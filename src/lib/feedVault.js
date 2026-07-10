import { supabase } from './supabase'

/*
  The photo store for the Feed Planner: one small row per photo, insert-only.

  Primary home: the feed_photo_vault table (see
  supabase_feed_vault_migration.sql), whose RLS policies forbid update and
  delete entirely. Until that table exists, photos are stored as hidden rows
  in the existing notes table (updated_by 'feed-vault', months in the 8xxx
  range, title = photo id). Nothing in the app ever deletes from either
  place — removing a photo from the feed only removes it from the order row,
  so every photo ever added stays recoverable. Once the real table exists,
  all photos are re-backfilled into it automatically.

  Per-photo rows exist because the previous design — every photo inside one
  ~6MB notes row — began hitting Postgres statement timeouts on update,
  which is how changes (and potentially photos) were getting lost.
*/

let vaultTableMissing = false
const vaultedIds = new Set()
const pendingIds = new Set() // being written right now — stops concurrent duplicate inserts
let inFlight = 0

export function vaultWritesInFlight() {
  return inFlight
}

export function isVaulted(id) {
  return vaultedIds.has(id)
}

function isMissingTableError(error) {
  return error?.code === 'PGRST205' || /find the table/i.test(error?.message || '')
}

// The database occasionally cancels big reads under load ("statement
// timeout") — retry with backoff before giving up.
async function withRetry(fn, attempts = 3) {
  let lastError
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastError = e
      if (isMissingTableError(e)) throw e
      await new Promise(r => setTimeout(r, 1000 * (i + 1)))
    }
  }
  throw lastError
}

// Fabricate a far-future month for a fallback vault row. The exact date is
// meaningless — it only needs to keep clear of real months and the 9999-*
// feed sync rows.
function vaultMonth() {
  const year = 8000 + Math.floor(Math.random() * 900)
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Fetch vault photos as a Map(photo id → {id, image_url, caption}).
 * Reads BOTH homes and unions them, so nothing disappears mid-transition
 * after the migration runs. Pass `onlyIds` to fetch a subset.
 * Also seeds the dedupe set: only rows in the protected table count once it
 * exists, so running the migration triggers a fresh backfill into it.
 * Returns null if neither source could be read (never treat that as empty).
 */
export async function fetchVaultPhotos(onlyIds = null) {
  const map = new Map()
  let anySourceOk = false

  try {
    const { data, error } = await withRetry(async () => {
      let q = supabase.from('feed_photo_vault').select('photo_id,image_url,caption')
      if (onlyIds) q = q.in('photo_id', onlyIds)
      const res = await q
      if (res.error && !isMissingTableError(res.error)) throw res.error
      return res
    })
    if (!error) {
      vaultTableMissing = false
      anySourceOk = true
      data.forEach(r => {
        map.set(r.photo_id, { id: r.photo_id, image_url: r.image_url, caption: r.caption || '' })
        if (!onlyIds) vaultedIds.add(r.photo_id)
      })
    } else if (isMissingTableError(error)) {
      vaultTableMissing = true
    } else {
      throw error
    }
  } catch (e) {
    console.warn('[feed-vault] table read failed:', e.message)
  }

  // The notes-table fallback only matters while the protected table is
  // missing, or for targeted lookups — a full read of it is megabytes and
  // increasingly timeout-prone, so skip it once the primary answers.
  if (anySourceOk && !onlyIds) return map

  try {
    const { data } = await withRetry(async () => {
      let q = supabase.from('notes').select('title,content').eq('updated_by', 'feed-vault')
      if (onlyIds) q = q.in('title', onlyIds)
      const res = await q
      if (res.error) throw res.error
      return res
    })
    anySourceOk = true
    data.forEach(r => {
      try {
        const p = JSON.parse(r.content)
        if (p.photo_id && p.image_url && !map.has(p.photo_id)) {
          map.set(p.photo_id, { id: p.photo_id, image_url: p.image_url, caption: p.caption || '' })
        }
        if (!onlyIds && vaultTableMissing && p.photo_id) vaultedIds.add(p.photo_id)
      } catch (e) {}
    })
  } catch (e) {
    console.warn('[feed-vault] fallback read failed:', e.message)
  }

  return anySourceOk ? map : null
}

async function insertVaultRows(photos) {
  if (!vaultTableMissing) {
    const { error } = await supabase.from('feed_photo_vault').insert(
      photos.map(p => ({ photo_id: p.id, image_url: p.image_url, caption: p.caption || '' }))
    )
    if (!error) return
    if (!isMissingTableError(error)) throw error
    vaultTableMissing = true
  }
  const { error } = await supabase.from('notes').insert(
    photos.map(p => ({
      month: vaultMonth(),
      title: p.id,
      updated_by: 'feed-vault',
      content: JSON.stringify({ photo_id: p.id, image_url: p.image_url, caption: p.caption || '' }),
    }))
  )
  if (error) throw error
}

/**
 * Durably store photos. Already-vaulted ids are skipped, so re-offering the
 * whole grid is cheap and self-healing. Resolves when every offered photo is
 * saved; throws if any batch ultimately fails (callers surface the error and
 * re-offer later).
 */
export async function vaultPhotos(photos) {
  const fresh = photos.filter(p =>
    p && p.id && p.image_url && !vaultedIds.has(p.id) && !pendingIds.has(p.id)
  )
  if (!fresh.length) return
  fresh.forEach(p => pendingIds.add(p.id))
  inFlight++
  try {
    for (let i = 0; i < fresh.length; i += 5) {
      const batch = fresh.slice(i, i + 5)
      let lastError = null
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await insertVaultRows(batch)
          batch.forEach(p => vaultedIds.add(p.id))
          lastError = null
          break
        } catch (e) {
          lastError = e
          console.warn('[feed-vault] write failed:', e.message)
          await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
        }
      }
      if (lastError) throw lastError
    }
  } finally {
    fresh.forEach(p => pendingIds.delete(p.id))
    inFlight--
  }
}
