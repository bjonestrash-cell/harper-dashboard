import { useState, useCallback, createContext, useContext } from 'react'
import { addMonths, subMonths, addWeeks, subWeeks, startOfMonth } from 'date-fns'

const MonthContext = createContext()

export function MonthProvider({ children }) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()))

  const nextMonth = useCallback(() => {
    setCurrentMonth(prev => addMonths(prev, 1))
  }, [])

  const prevMonth = useCallback(() => {
    setCurrentMonth(prev => subMonths(prev, 1))
  }, [])

  const nextWeek = useCallback(() => {
    setCurrentMonth(prev => addWeeks(prev, 1))
  }, [])

  const prevWeek = useCallback(() => {
    setCurrentMonth(prev => subWeeks(prev, 1))
  }, [])

  const goToToday = useCallback(() => {
    setCurrentMonth(startOfMonth(new Date()))
  }, [])

  return (
    <MonthContext.Provider value={{ currentMonth, nextMonth, prevMonth, nextWeek, prevWeek, setCurrentMonth, goToToday }}>
      {children}
    </MonthContext.Provider>
  )
}

export function useMonth() {
  const context = useContext(MonthContext)
  if (!context) throw new Error('useMonth must be used within MonthProvider')
  return context
}
