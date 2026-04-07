import { useState, useEffect, useRef } from 'react'
import { supabase, createChannel } from '../lib/supabase'

export function useRealtime(table, fetchFn, deps = []) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef(null)
  const fetchFnRef = useRef(fetchFn)

  // Serialize deps to a stable string key
  const depsKey = JSON.stringify(deps)

  // Keep fetchFn ref current
  fetchFnRef.current = fetchFn

  useEffect(() => {
    let cancelled = false

    const fetchData = async () => {
      try {
        const result = await fetchFnRef.current()
        if (!cancelled && result.data) setData(result.data)
      } catch (err) {
        console.error(`Error fetching ${table}:`, err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()

    // Clean up previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = createChannel(`rt-${table}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table,
      }, (payload) => {
        setData(prev => {
          if (prev.find(item => item.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table,
      }, (payload) => {
        setData(prev => prev.map(item =>
          item.id === payload.new.id ? payload.new : item
        ))
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table,
      }, (payload) => {
        setData(prev => prev.filter(item => item.id !== payload.old.id))
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [table, depsKey])

  const refetch = async () => {
    try {
      const result = await fetchFnRef.current()
      if (result.data) setData(result.data)
    } catch (err) {
      console.error(`Error refetching ${table}:`, err)
    }
  }

  return { data, setData, loading, refetch }
}

export function useSupabaseConnection() {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const channel = createChannel('connection-check')
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED')
      })

    return () => supabase.removeChannel(channel)
  }, [])

  return connected
}
