import { useState, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useMonth } from '../hooks/useMonth'
import { useRealtime } from '../hooks/useRealtime'
import MonthSelector from '../components/MonthSelector'
import PromotionCard from '../components/PromotionCard'
import Modal from '../components/Modal'
import DatePicker from '../components/DatePicker'
import './PromotionsPage.css'

const PLATFORM_OPTIONS = ['instagram', 'tiktok', 'email']
const PROMO_COLORS = ['#F4A7B9', '#D4C4A8', '#A8C4D4', '#C4D4A8', '#D4A8C4', '#1A1412']

export default function PromotionsPage() {
  const { currentMonth } = useMonth()
  const [showModal, setShowModal] = useState(false)
  const [editingPromo, setEditingPromo] = useState(null)
  const [orderForm, setOrderForm] = useState({ date: format(new Date(), 'yyyy-MM-dd'), orders: '', notes: '' })
  const [orderLog, setOrderLog] = useState([])

  const fetchPromos = useCallback(() =>
    supabase.from('promotions').select('*').order('start_date'),
    []
  )

  const { data: promotions, setData: setPromotions } = useRealtime('promotions', fetchPromos)

  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')

  const stats = {
    active: promotions.filter(p => p.start_date <= todayStr && p.end_date >= todayStr).length,
    upcoming: promotions.filter(p => p.start_date > todayStr).length,
    thisMonth: promotions.filter(p => {
      const monthStr = format(currentMonth, 'yyyy-MM')
      return p.start_date?.startsWith(monthStr) || p.end_date?.startsWith(monthStr)
    }).length,
    total: promotions.length,
  }

  const monthStr = format(currentMonth, 'yyyy-MM')
  const monthPromos = promotions.filter(p =>
    (p.start_date && p.start_date.startsWith(monthStr)) ||
    (p.end_date && p.end_date.startsWith(monthStr)) ||
    (p.start_date && p.end_date && p.start_date < monthStr && p.end_date > monthStr)
  )

  const handleEdit = (promo) => { setEditingPromo(promo); setShowModal(true) }

  const handleDuplicate = async (promo) => {
    const { id, created_at, ...rest } = promo
    const { data, error } = await supabase.from('promotions').insert({ ...rest, name: `${rest.name} (Copy)` }).select()
    if (!error && data?.[0]) setPromotions(prev => [...prev, data[0]])
  }

  const handleArchive = async (promo) => {
    const { data, error } = await supabase.from('promotions').update({ status: 'ended' }).eq('id', promo.id).select()
    if (!error && data?.[0]) setPromotions(prev => prev.map(p => p.id === promo.id ? data[0] : p))
  }

  const deletePromotion = async (id) => {
    if (!window.confirm('Delete this promotion?')) return
    const { error } = await supabase.from('promotions').delete().eq('id', id)
    if (!error) setPromotions(prev => prev.filter(p => p.id !== id))
  }

  const handleAddOrder = () => {
    if (!orderForm.orders) return
    setOrderLog(prev => [...prev, { ...orderForm, id: Date.now() }])
    setOrderForm({ date: format(new Date(), 'yyyy-MM-dd'), orders: '', notes: '' })
  }

  const totalOrders = orderLog.reduce((sum, o) => sum + Number(o.orders || 0), 0)
  const peakDay = orderLog.length > 0
    ? orderLog.reduce((max, o) => Number(o.orders) > Number(max.orders) ? o : max, orderLog[0])
    : null

  return (
    <div className="promotions-page">
      <div className="page-header">
        <h1 className="page-title">Promotions</h1>
        <button className="btn-outline" onClick={() => { setEditingPromo(null); setShowModal(true) }}>
          + Add Promotion
        </button>
      </div>

      <div className="page-container">
        <MonthSelector />

        <div className="stats-row">
          {[
            { label: 'Active Now', value: stats.active },
            { label: 'Upcoming', value: stats.upcoming },
            { label: 'This Month', value: stats.thisMonth },
            { label: 'Total', value: stats.total },
          ].map(s => (
            <div key={s.label} className="stat-card card">
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="timeline-section">
          <h2 className="section-header" style={{ marginBottom: 16 }}>Timeline</h2>
          <div className="timeline-bar">
            {monthPromos.map(promo => {
              const monthStart = parseISO(format(currentMonth, 'yyyy-MM-01'))
              const daysInMonth = 30
              const startDay = Math.max(0, (parseISO(promo.start_date).getTime() - monthStart.getTime()) / 86400000)
              const endDay = Math.min(daysInMonth, (parseISO(promo.end_date).getTime() - monthStart.getTime()) / 86400000)
              const left = (startDay / daysInMonth) * 100
              const width = ((endDay - startDay) / daysInMonth) * 100

              return (
                <div key={promo.id} className="timeline-promo"
                  style={{ left: `${Math.max(0, left)}%`, width: `${Math.max(2, Math.min(100, width))}%`, background: promo.color || '#F4A7B9' }}
                  title={promo.name}>
                  <span className="timeline-promo-label">{promo.name}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Promotion Cards */}
        <div className="promos-list">
          {monthPromos.length === 0 && <p className="caption" style={{ textAlign: 'center', padding: 40 }}>No promotions this month</p>}
          {monthPromos.map(promo => (
            <PromotionCard key={promo.id} promotion={promo} onEdit={handleEdit} onDuplicate={handleDuplicate} onArchive={handleArchive} onDelete={deletePromotion} />
          ))}
        </div>

        {/* Order Volume */}
        <div className="order-volume-section card">
          <h2 className="section-header" style={{ marginBottom: 8 }}>Order Volume Tracker</h2>
          <div className="caption" style={{ marginBottom: 16 }}>Track daily order counts during active promotions (baseline: 300+/day)</div>

          {orderLog.length > 0 && (
            <>
              <table className="order-table">
                <thead>
                  <tr><th>Date</th><th>Orders</th><th>Notes</th></tr>
                </thead>
                <tbody>
                  {orderLog.map(o => (
                    <tr key={o.id}><td>{format(parseISO(o.date), 'MMM d')}</td><td>{o.orders}</td><td>{o.notes}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="order-summary">
                <span>Total: <strong>{totalOrders}</strong></span>
                {peakDay && <span>Peak: <strong>{peakDay.orders}</strong> on {format(parseISO(peakDay.date), 'MMM d')}</span>}
              </div>
            </>
          )}

          <div className="order-input-row">
            <input type="date" value={orderForm.date} onChange={(e) => setOrderForm(prev => ({ ...prev, date: e.target.value }))} />
            <input type="number" placeholder="Orders" value={orderForm.orders} onChange={(e) => setOrderForm(prev => ({ ...prev, orders: e.target.value }))} />
            <input type="text" placeholder="Notes" value={orderForm.notes} onChange={(e) => setOrderForm(prev => ({ ...prev, notes: e.target.value }))} />
            <button className="btn-save" style={{ width: 'auto', padding: '10px 20px' }} onClick={handleAddOrder}>Add</button>
          </div>
        </div>
      </div>

      {/* Floating + button */}
      <button className="fab-add" onClick={() => { setEditingPromo(null); setShowModal(true) }}>+</button>

      {showModal && (
        <PromoModal promo={editingPromo} setPromotions={setPromotions}
          onClose={() => { setShowModal(false); setEditingPromo(null) }} />
      )}
    </div>
  )
}

function PillSelect({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
      {options.map(opt => {
        const isActive = value === opt
        return (
          <button key={opt} onClick={() => onChange(opt)}
            style={{
              padding: '6px 16px', borderRadius: 20, border: '1px solid',
              borderColor: isActive ? 'var(--ink)' : 'var(--cream-deep)',
              backgroundColor: isActive ? 'var(--ink)' : 'transparent',
              color: isActive ? 'var(--cream)' : 'var(--ink-mid)',
              fontSize: 11, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase',
              fontFamily: 'Inter, sans-serif', transition: 'all 0.2s ease',
            }}>{opt}</button>
        )
      })}
    </div>
  )
}

function MultiPillSelect({ options, values, onToggle }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
      {options.map(opt => {
        const isActive = values.includes(opt)
        return (
          <button key={opt} onClick={() => onToggle(opt)}
            style={{
              padding: '6px 16px', borderRadius: 20, border: '1px solid',
              borderColor: isActive ? 'var(--ink)' : 'var(--cream-deep)',
              backgroundColor: isActive ? 'var(--ink)' : 'transparent',
              color: isActive ? 'var(--cream)' : 'var(--ink-mid)',
              fontSize: 11, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase',
              fontFamily: 'Inter, sans-serif', transition: 'all 0.2s ease',
            }}>{opt}</button>
        )
      })}
    </div>
  )
}

function PromoModal({ promo, setPromotions, onClose }) {
  const [form, setForm] = useState({
    name: promo?.name || '',
    start_date: promo?.start_date || '',
    end_date: promo?.end_date || '',
    discount: promo?.discount || '',
    platforms: promo?.platforms || [],
    color: promo?.color || '#F4A7B9',
    notes: promo?.notes || '',
    status: promo?.status || 'upcoming',
  })
  const [saving, setSaving] = useState(false)

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const togglePlatform = (p) => {
    setForm(prev => ({
      ...prev,
      platforms: prev.platforms.includes(p)
        ? prev.platforms.filter(x => x !== p)
        : [...prev.platforms, p]
    }))
  }

  const handleSave = async () => {
    if (!form.name) return
    setSaving(true)
    try {
      if (promo) {
        const { data, error } = await supabase.from('promotions').update(form).eq('id', promo.id).select()
        if (!error && data?.[0]) setPromotions(prev => prev.map(p => p.id === promo.id ? data[0] : p))
      } else {
        const { data, error } = await supabase.from('promotions').insert(form).select()
        if (!error && data?.[0]) setPromotions(prev => [...prev, data[0]])
      }
      onClose()
    } catch (err) { console.error('Error saving promotion:', err) }
    finally { setSaving(false) }
  }

  return (
    <Modal onClose={onClose}>
      <div style={{ padding: 32, position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', fontSize: 22, color: 'var(--ink-light)', lineHeight: 1, padding: 4, transition: 'color 0.2s' }}
          onMouseEnter={e => e.target.style.color = 'var(--ink)'} onMouseLeave={e => e.target.style.color = 'var(--ink-light)'}>&times;</button>

        <h2 style={{ fontSize: 11, fontWeight: 500, letterSpacing: 4, textTransform: 'uppercase', color: 'var(--ink-light)', marginBottom: 24 }}>
          {promo ? 'Edit Promotion' : 'New Promotion'}
        </h2>

        <div style={{ marginBottom: 24 }}>
          <label className="form-label">Name</label>
          <input type="text" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Mother's Day Sale" />
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            <DatePicker label="Start Date" value={form.start_date} onChange={(v) => update('start_date', v)} />
          </div>
          <div style={{ flex: 1 }}>
            <DatePicker label="End Date" value={form.end_date} onChange={(v) => update('end_date', v)} />
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label className="form-label">Discount / Offer</label>
          <input type="text" value={form.discount} onChange={(e) => update('discount', e.target.value)} placeholder="20% off everything" />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label className="form-label">Platforms</label>
          <MultiPillSelect options={PLATFORM_OPTIONS} values={form.platforms} onToggle={togglePlatform} />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label className="form-label">Color</label>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {PROMO_COLORS.map(c => (
              <button key={c} onClick={() => update('color', c)}
                style={{
                  width: 28, height: 28, borderRadius: '50%', background: c, border: 'none',
                  boxShadow: form.color === c ? `0 0 0 2px var(--white), 0 0 0 4px ${c}` : 'none',
                  transition: 'box-shadow 0.2s ease', flexShrink: 0,
                }} />
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label className="form-label">Notes</label>
          <textarea rows={3} value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Campaign details..." />
        </div>

        <div style={{ marginBottom: 32 }}>
          <label className="form-label">Status</label>
          <PillSelect options={['upcoming', 'active', 'ended']} value={form.status} onChange={(v) => update('status', v)} />
        </div>

        <button className="btn-save" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </Modal>
  )
}
