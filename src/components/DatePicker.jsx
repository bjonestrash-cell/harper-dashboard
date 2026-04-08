import { useState, useEffect } from 'react'
import {
  format, addMonths, subMonths, startOfMonth,
  endOfMonth, eachDayOfInterval, isSameDay,
  isSameMonth, startOfWeek, endOfWeek, isBefore, startOfDay
} from 'date-fns'

export default function DatePicker({ value, onChange, label, isOpen, onOpen, onClose, minDate, persistOpen }) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(
    value ? new Date(value + 'T12:00:00') : new Date()
  )

  // Use controlled or internal open state
  const open = isOpen !== undefined ? isOpen : internalOpen
  const handleOpen = () => { onOpen ? onOpen() : setInternalOpen(true) }
  const handleClose = () => { onClose ? onClose() : setInternalOpen(false) }

  // When opening with minDate, navigate to that month
  useEffect(() => {
    if (open && minDate) {
      setViewMonth(new Date(minDate + 'T12:00:00'))
    } else if (open && value) {
      setViewMonth(new Date(value + 'T12:00:00'))
    }
  }, [open])

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewMonth)),
    end: endOfWeek(endOfMonth(viewMonth)),
  })

  const selected = value ? new Date(value + 'T12:00:00') : null
  const minDateObj = minDate ? startOfDay(new Date(minDate + 'T12:00:00')) : null

  return (
    <div style={{ position: 'relative' }}>
      {label && (
        <span style={{
          fontSize: 9, fontWeight: 500, letterSpacing: 3,
          textTransform: 'uppercase', color: 'var(--ink-light)',
          display: 'block', marginBottom: 8,
        }}>{label}</span>
      )}

      {isOpen === undefined && (
        <button
          onClick={() => open ? handleClose() : handleOpen()}
          style={{
            background: 'transparent', border: 'none',
            borderBottom: '1px solid var(--cream-deep)',
            padding: '8px 0', fontSize: 14, fontWeight: 300,
            color: selected ? 'var(--ink)' : 'var(--ink-light)',
            fontFamily: 'Inter, sans-serif', width: '100%',
            textAlign: 'left', letterSpacing: 0.3,
          }}
        >
          {selected ? format(selected, 'MMM d, yyyy') : 'Select date'}
        </button>
      )}

      {open && (
        <>
          <div onClick={handleClose}
            style={{ position: 'fixed', inset: 0, zIndex: 299 }} />
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 300,
            backgroundColor: 'var(--white)', border: '1px solid var(--cream-deep)',
            padding: 20, marginTop: 8, minWidth: 280,
            boxShadow: '0 8px 32px rgba(26,20,18,0.1)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <button onClick={() => setViewMonth(subMonths(viewMonth, 1))}
                style={{ background: 'none', border: 'none', fontSize: 16, color: 'var(--ink-mid)', padding: '4px 8px' }}>
                &larr;
              </button>
              <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ink)' }}>
                {format(viewMonth, 'MMM yyyy')}
              </span>
              <button onClick={() => setViewMonth(addMonths(viewMonth, 1))}
                style={{ background: 'none', border: 'none', fontSize: 16, color: 'var(--ink-mid)', padding: '4px 8px' }}>
                &rarr;
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 8 }}>
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <div key={i} style={{ textAlign: 'center', fontSize: 9, fontWeight: 500, letterSpacing: 1, color: 'var(--ink-light)', padding: '4px 0' }}>{d}</div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {days.map((day, i) => {
                const isSelected = selected && isSameDay(day, selected)
                const isCurrentMonth = isSameMonth(day, viewMonth)
                const isToday = isSameDay(day, new Date())
                const isDisabled = minDateObj && isBefore(startOfDay(day), minDateObj)

                return (
                  <button key={i}
                    onClick={() => {
                      if (isDisabled) return
                      onChange(format(day, 'yyyy-MM-dd'))
                      if (!persistOpen) handleClose()
                    }}
                    disabled={isDisabled}
                    style={{
                      width: '100%', aspectRatio: '1', border: 'none', borderRadius: '50%',
                      backgroundColor: isSelected ? 'var(--ink)' : isToday && !isDisabled ? 'var(--pink-light)' : 'transparent',
                      color: isDisabled ? 'var(--cream-deep)' : isSelected ? 'var(--cream)' : isCurrentMonth ? 'var(--ink)' : 'var(--cream-deep)',
                      fontSize: 12, fontWeight: isSelected ? 500 : 300,
                      fontFamily: 'Inter, sans-serif', transition: 'all 0.15s ease',
                      cursor: isDisabled ? 'default' : 'pointer',
                      pointerEvents: isDisabled ? 'none' : 'auto',
                    }}
                    onMouseEnter={e => { if (!isSelected && !isDisabled) e.target.style.backgroundColor = 'var(--cream-mid)' }}
                    onMouseLeave={e => { if (!isSelected && !isDisabled) e.target.style.backgroundColor = isToday ? 'var(--pink-light)' : 'transparent' }}
                  >{format(day, 'd')}</button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
