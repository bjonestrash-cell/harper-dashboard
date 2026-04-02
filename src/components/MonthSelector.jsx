import { format } from 'date-fns'
import { useMonth } from '../hooks/useMonth'
import './MonthSelector.css'

export default function MonthSelector() {
  const { currentMonth, nextMonth, prevMonth } = useMonth()

  return (
    <div className="month-selector">
      <button className="month-arrow" onClick={prevMonth} aria-label="Previous month">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <span className="month-label">{format(currentMonth, 'MMMM yyyy')}</span>
      <button className="month-arrow" onClick={nextMonth} aria-label="Next month">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>
  )
}
