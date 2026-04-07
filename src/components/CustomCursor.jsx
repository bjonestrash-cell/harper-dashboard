import { useEffect, useRef, useState } from 'react'
import '../styles/cursor.css'

export default function CustomCursor() {
  const cursorRef = useRef(null)
  const followerRef = useRef(null)
  const [isMobile] = useState(() => window.innerWidth < 768)

  useEffect(() => {
    if (isMobile) return

    const cursor = cursorRef.current
    const follower = followerRef.current
    if (!cursor || !follower) return

    let mouseX = 0, mouseY = 0
    let followerX = 0, followerY = 0
    let animId = null

    const isDarkBackground = (el) => {
      // Walk up the DOM to find if cursor is over a dark element
      let node = el
      for (let i = 0; i < 6; i++) {
        if (!node || node === document.body) break
        const bg = window.getComputedStyle(node).backgroundColor
        const match = bg.match(/\d+/g)
        if (match) {
          const [r, g, b] = match.map(Number)
          // Luminance check — treat as dark if luminance < 0.15
          const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
          if (luminance < 0.15 && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return true
        }
        node = node.parentElement
      }
      return false
    }

    const onMouseMove = (e) => {
      mouseX = e.clientX
      mouseY = e.clientY
      cursor.style.transform =
        `translate(${mouseX - 12}px, ${mouseY - 12}px)`

      // Flip cursor pink over dark backgrounds
      const el = document.elementFromPoint(mouseX, mouseY)
      if (el && isDarkBackground(el)) {
        cursor.classList.add('cursor-dark-bg')
      } else {
        cursor.classList.remove('cursor-dark-bg')
      }
    }

    // Smooth follower with lerp
    const animate = () => {
      followerX += (mouseX - followerX) * 0.12
      followerY += (mouseY - followerY) * 0.12
      follower.style.transform =
        `translate(${followerX - 20}px, ${followerY - 20}px)`
      animId = requestAnimationFrame(animate)
    }

    // Scale up on clickable elements
    const onMouseEnter = () => {
      cursor.classList.add('cursor-hover')
      follower.classList.add('follower-hover')
    }
    const onMouseLeave = () => {
      cursor.classList.remove('cursor-hover')
      follower.classList.remove('follower-hover')
    }

    document.addEventListener('mousemove', onMouseMove)

    // Attach to clickable elements + use MutationObserver for dynamic elements
    const attachListeners = () => {
      const clickables = document.querySelectorAll(
        'a, button, [role="button"], input, select, textarea, label'
      )
      clickables.forEach(el => {
        el.addEventListener('mouseenter', onMouseEnter)
        el.addEventListener('mouseleave', onMouseLeave)
      })
    }

    attachListeners()

    // Re-attach when DOM changes
    const observer = new MutationObserver(() => attachListeners())
    observer.observe(document.body, { childList: true, subtree: true })

    animId = requestAnimationFrame(animate)

    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      if (animId) cancelAnimationFrame(animId)
      observer.disconnect()
    }
  }, [isMobile])

  // Only show on desktop
  if (isMobile) return null

  return (
    <>
      {/* Main cursor — the H */}
      <div ref={cursorRef} className="custom-cursor">
        <span className="cursor-letter">H</span>
      </div>
      {/* Soft follower circle */}
      <div ref={followerRef} className="cursor-follower" />
    </>
  )
}
