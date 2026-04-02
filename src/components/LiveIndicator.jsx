import { useSupabaseConnection } from '../hooks/useRealtime'
import './LiveIndicator.css'

export default function LiveIndicator() {
  const connected = useSupabaseConnection()

  return (
    <div className="live-indicator">
      <span className={`live-dot ${connected ? 'connected' : ''}`} />
      <span className="live-text">{connected ? 'Live' : 'Connecting...'}</span>
    </div>
  )
}
