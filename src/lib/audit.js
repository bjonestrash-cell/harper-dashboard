import { supabase } from './supabase'

/**
 * Log an action to the audit_log table.
 * Fire-and-forget — never blocks the calling code.
 */
export function logAudit({ table, action, recordId, user, summary, details }) {
  supabase
    .from('audit_log')
    .insert({
      table_name: table,
      action,
      record_id: recordId || null,
      user_name: user || localStorage.getItem('harper-user') || 'unknown',
      summary,
      details: details || null,
    })
    .then(({ error }) => {
      if (error) console.warn('[audit]', error.message)
    })
}
