import { useState, useEffect } from 'react'
import { supabase, createChannel } from '../lib/supabase'

export function usePresence(currentUser, currentPage) {
  const [onlineUsers, setOnlineUsers] = useState([])

  useEffect(() => {
    if (!currentUser) return

    const channel = createChannel('presence', {
      config: { presence: { key: currentUser } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users = Object.entries(state).map(([key, presences]) => ({
          user: key,
          page: presences[0]?.page,
        }))
        setOnlineUsers(users)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user: currentUser,
            page: currentPage,
          })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUser, currentPage])

  return onlineUsers
}
