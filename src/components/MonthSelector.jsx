import { format, startOfWeek, endOfWeek, isSameMonth } from 'date-fns'
import { useMonth } from '../hooks/useMonth'
import './MonthSelector.css'

export default function MonthSelector({ mode = 'month' }) {
  const { currentMonth, nextMonth, prevMonth, nextWeek, prevWeek, goToToday } = useMonth()

  const handlePrev = mode === 'week' ? prevWeek : prevMonth
  const handleNext = mode === 'week' ? nextWeek : nextMonth
  const isToday = isSameMonth(currentMonth, new Date())

  const label = mode === 'week'
    ? `${format(startOfWeek(currentMonth), 'MMM d')} – ${format(endOfWeek(currentMonth), 'MMM d, yyyy')}`
    : format(currentMonth, 'MMMM yyyy').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <div className="month-selector">
      <button className="month-arrow" onClick={handlePrev} aria-label={mode === 'week' ? 'Previous week' : 'Previous month'}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <span className="month-label">{label}</span>
      <button className="month-arrow" onClick={handleNext} aria-label={mode === 'week' ? 'Next week' : 'Next month'}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      {!isToday && (
        <button onClick={goToToday} style={{
          marginLeft: 12, padding: '4px 12px', borderRadius: 9999,
          border: '1px solid var(--cream-deep)', background: 'transparent',
          fontSize: 10, fontWeight: 500, letterSpacing: 1.5,
          textTransform: 'uppercase', color: 'var(--ink-light)',
          fontFamily: 'Inter, sans-serif', cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}>Today</button>
      )}
    </div>
  )
}
