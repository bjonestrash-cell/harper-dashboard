import { useState, useRef } from 'react'

export default function SwipeToDelete({ children, onDelete, threshold = 120 }) {
  const [offsetX, setOffsetX] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const locked = useRef(false) // lock direction once determined

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

    // Lock direction on first significant move
    if (!locked.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      locked.current = true
      if (Math.abs(dy) > Math.abs(dx)) {
        // Vertical scroll — cancel swipe
        setSwiping(false)
        setOffsetX(0)
        return
      }
    }

    if (dx < 0) {
      setOffsetX(dx)
      e.preventDefault() // prevent scroll while swiping
    }
  }

  const onTouchEnd = () => {
    if (offsetX < -threshold) {
      // Swipe far enough — animate out then delete
      setOffsetX(-window.innerWidth)
      setTimeout(() => {
        onDelete()
        setOffsetX(0)
      }, 250)
    } else {
      setOffsetX(0)
    }
    setSwiping(false)
  }

  // Mouse support for desktop trackpad swipe
  const onMouseDown = (e) => {
    startX.current = e.clientX
    setSwiping(true)
  }
  const onMouseMove = (e) => {
    if (!swiping) return
    const dx = e.clientX - startX.current
    if (dx < 0) setOffsetX(dx)
  }
  const onMouseUp = () => {
    if (offsetX < -threshold) {
      setOffsetX(-window.innerWidth)
      setTimeout(() => { onDelete(); setOffsetX(0) }, 250)
    } else {
      setOffsetX(0)
    }
    setSwiping(false)
  }

  const showingDelete = offsetX < -30
  const progress = Math.min(Math.abs(offsetX) / threshold, 1)

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Delete background */}
      <div style={{
        position: 'absolute',
        top: 0, right: 0, bottom: 0,
        width: Math.abs(offsetX) + 20,
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

      {/* Content */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={swiping ? onMouseMove : undefined}
        onMouseUp={swiping ? onMouseUp : undefined}
        onMouseLeave={swiping ? onMouseUp : undefined}
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
