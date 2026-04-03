import { format, startOfWeek, endOfWeek } from 'date-fns'
import { useMonth } from '../hooks/useMonth'
import './MonthSelector.css'

export default function MonthSelector({ mode = 'month' }) {
  const { currentMonth, nextMonth, prevMonth, nextWeek, prevWeek } = useMonth()

  const handlePrev = mode === 'week' ? prevWeek : prevMonth
  const handleNext = mode === 'week' ? nextWeek : nextMonth

  const label = mode === 'week'
    ? `${format(startOfWeek(currentMonth), 'MMM d')} – ${format(endOfWeek(currentMonth), 'MMM d, yyyy')}`
    : format(currentMonth, 'MMMM yyyy')

  return (
    <div className="month-selector">
      <button className="month-arrow" onClick={handlePrev} aria-label={mode === 'week' ? 'Previous week' : 'Previous month'}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <span className="month-label">{label}</span>
      <button className="month-arrow" onClick={handleNext} aria-label={mode === 'week' ? 'Next week' : 'Next month'}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>
  )
}
