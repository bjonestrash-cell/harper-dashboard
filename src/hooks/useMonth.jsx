import { useState, useCallback, createContext, useContext } from 'react'
import { addMonths, subMonths, startOfMonth } from 'date-fns'

const MonthContext = createContext()

export function MonthProvider({ children }) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()))

  const nextMonth = useCallback(() => {
    setCurrentMonth(prev => addMonths(prev, 1))
  }, [])

  const prevMonth = useCallback(() => {
    setCurrentMonth(prev => subMonths(prev, 1))
  }, [])

  return (
    <MonthContext.Provider value={{ currentMonth, nextMonth, prevMonth, setCurrentMonth }}>
      {children}
    </MonthContext.Provider>
  )
}

export function useMonth() {
  const context = useContext(MonthContext)
  if (!context) throw new Error('useMonth must be used within MonthProvider')
  return context
}
