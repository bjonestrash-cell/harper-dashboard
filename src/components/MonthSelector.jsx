import { format } from 'date-fns'
import { useMonth } from '../hooks/useMonth'
import './MonthSelector.css'

export default function MonthSelector() {
  const { currentMonth, nextMonth, prevMonth } = useMonth()

  return (
    <div className="month-selector">
      <button className="month-arrow" onClick={prevMonth}>←</button>
      <span className="month-label">{format(currentMonth, 'MMMM yyyy')}</span>
      <button className="month-arrow" onClick={nextMonth}>→</button>
    </div>
  )
}
