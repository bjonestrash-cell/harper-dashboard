import { useState, useRef, useCallback, useEffect } from 'react'

export default function SwipeToDelete({ children, onDelete, threshold = 120 }) {
  const [offsetX, setOffsetX] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const containerRef = useRef(null)
  const startX = useRef(0)
  const startY = useRef(0)
  const locked = useRef(false)
  const accumulated = useRef(0)
  const resetTimer = useRef(null)
  const deleting = useRef(false)

  // ─── Touch (mobile) ───
  const onTouchStart = (e) => {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    locked.current = false
    setSwiping(true)
  }
  const onTouchMove = (e) => {
    if (!swiping) return
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current
    if (!locked.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      locked.current = true
      if (Math.abs(dy) > Math.abs(dx)) { setSwiping(false); setOffsetX(0); return }
    }
    if (dx < 0) { setOffsetX(dx); e.preventDefault() }
  }
  const onTouchEnd = () => {
    if (offsetX < -threshold && !deleting.current) {
      deleting.current = true
      setOffsetX(-window.innerWidth)
      setTimeout(() => { onDelete(); setOffsetX(0); deleting.current = false }, 250)
    } else { setOffsetX(0) }
    setSwiping(false)
  }

  // ─── Trackpad two-finger swipe (wheel events) ───
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleWheel = (e) => {
      // Two-finger horizontal swipe produces deltaX
      // Only care about leftward swipes (positive deltaX = swipe left)
      if (Math.abs(e.deltaX) < 2 || Math.abs(e.deltaY) > Math.abs(e.deltaX)) return

      e.preventDefault()
      accumulated.current += e.deltaX

      // Only allow swiping left (positive deltaX accumulation)
      if (accumulated.current < 0) accumulated.current = 0

      setOffsetX(-accumulated.current)
      setSwiping(true)

      // Reset after momentum stops (no wheel events for 300ms)
      clearTimeout(resetTimer.current)
      resetTimer.current = setTimeout(() => {
        if (accumulated.current > threshold && !deleting.current) {
          deleting.current = true
          setOffsetX(-window.innerWidth)
          setTimeout(() => { onDelete(); setOffsetX(0); accumulated.current = 0; deleting.current = false }, 250)
        } else {
          setOffsetX(0)
          accumulated.current = 0
        }
        setSwiping(false)
      }, 300)
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [onDelete, threshold])

  const showingDelete = offsetX < -30
  const progress = Math.min(Math.abs(offsetX) / threshold, 1)

  return (
    <div ref={containerRef} style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Delete background — only rendered while swiping */}
      {offsetX < 0 && (
        <div style={{
          position: 'absolute',
          top: 0, right: 0, bottom: 0,
          width: Math.abs(offsetX),
          backgroundColor: `rgba(180, 84, 80, ${0.15 + progress * 0.7})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: 24,
          transition: swiping ? 'none' : 'all 0.25s ease',
        }}>
          {showingDelete && (
            <span style={{
              fontSize: 10, fontWeight: 500, letterSpacing: 2,
              textTransform: 'uppercase', color: '#B85450',
              fontFamily: 'Inter, sans-serif',
              opacity: progress,
            }}>Delete</span>
          )}
        </div>
      )}

      {/* Content */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: swiping ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.32, 1)',
          position: 'relative',
          zIndex: 1,
          backgroundColor: 'inherit',
          userSelect: swiping ? 'none' : 'auto',
        }}
      >
        {children}
      </div>
    </div>
  )
}
