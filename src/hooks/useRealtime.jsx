import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useRealtime(table, fetchFn, deps = []) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const result = await fetchFn()
      if (result.data) setData(result.data)
    } catch (err) {
      console.error(`Error fetching ${table}:`, err)
    } finally {
      setLoading(false)
    }
  }, [table, fetchFn])

  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel(`realtime-${table}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => fetchData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, fetchData, ...deps])

  return { data, loading, refetch: fetchData }
}

export function useSupabaseConnection() {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const channel = supabase
      .channel('connection-check')
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return connected
}
