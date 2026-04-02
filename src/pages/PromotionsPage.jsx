import { useState, useCallback } from 'react'
import { format, parseISO, isWithinInterval, isBefore, isAfter } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useMonth } from '../hooks/useMonth'
import { useRealtime } from '../hooks/useRealtime'
import MonthSelector from '../components/MonthSelector'
import PromotionCard from '../components/PromotionCard'
import Modal from '../components/Modal'
import './PromotionsPage.css'

const PLATFORM_OPTIONS = ['instagram', 'tiktok', 'email']
const PROMO_COLORS = ['#F4A7B9', '#E8839A', '#A8D4A8', '#8EC5E8', '#E8D4A8', '#C4A8E8']

export default function PromotionsPage() {
  const { currentMonth } = useMonth()
  const [showModal, setShowModal] = useState(false)
  const [editingPromo, setEditingPromo] = useState(null)
  const [showOrderEntry, setShowOrderEntry] = useState(false)
  const [orderForm, setOrderForm] = useState({ date: format(new Date(), 'yyyy-MM-dd'), orders: '', notes: '' })
  const [orderLog, setOrderLog] = useState([])

  const fetchPromos = useCallback(() =>
    supabase.from('promotions').select('*').order('start_date'),
    []
  )

  const { data: promotions } = useRealtime('promotions', fetchPromos)

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

  const handleEdit = (promo) => {
    setEditingPromo(promo)
    setShowModal(true)
  }

  const handleDuplicate = async (promo) => {
    const { id, created_at, ...rest } = promo
    await supabase.from('promotions').insert({ ...rest, name: `${rest.name} (Copy)` })
  }

  const handleArchive = async (promo) => {
    await supabase.from('promotions').update({ status: 'ended' }).eq('id', promo.id)
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
            const startDay = Math.max(0, (parseISO(promo.start_date).getTime() - monthStart.getTime()) / (86400000))
            const endDay = Math.min(daysInMonth, (parseISO(promo.end_date).getTime() - monthStart.getTime()) / (86400000))
            const left = (startDay / daysInMonth) * 100
            const width = ((endDay - startDay) / daysInMonth) * 100

            return (
              <div
                key={promo.id}
                className="timeline-promo"
                style={{
                  left: `${Math.max(0, left)}%`,
                  width: `${Math.max(2, Math.min(100, width))}%`,
                  background: promo.color || '#F4A7B9',
                }}
                title={promo.name}
              >
                <span className="timeline-promo-label">{promo.name}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Promotion Cards */}
      <div className="promos-list">
        {monthPromos.length === 0 && (
          <p className="caption" style={{ textAlign: 'center', padding: 40 }}>No promotions this month</p>
        )}
        {monthPromos.map(promo => (
          <PromotionCard
            key={promo.id}
            promotion={promo}
            onEdit={handleEdit}
            onDuplicate={handleDuplicate}
            onArchive={handleArchive}
          />
        ))}
      </div>

      {/* Order Volume */}
      <div className="order-volume-section">
        <h2 className="section-header" style={{ marginBottom: 16 }}>Order Volume Tracker</h2>
        <div className="caption" style={{ marginBottom: 16 }}>Track daily order counts during active promotions (baseline: 300+/day)</div>

        {orderLog.length > 0 && (
          <>
            <table className="order-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Orders</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {orderLog.map(o => (
                  <tr key={o.id}>
                    <td>{format(parseISO(o.date), 'MMM d')}</td>
                    <td>{o.orders}</td>
                    <td>{o.notes}</td>
                  </tr>
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
          <input
            type="date"
            value={orderForm.date}
            onChange={(e) => setOrderForm(prev => ({ ...prev, date: e.target.value }))}
          />
          <input
            type="number"
            placeholder="Orders"
            value={orderForm.orders}
            onChange={(e) => setOrderForm(prev => ({ ...prev, orders: e.target.value }))}
          />
          <input
            type="text"
            placeholder="Notes"
            value={orderForm.notes}
            onChange={(e) => setOrderForm(prev => ({ ...prev, notes: e.target.value }))}
          />
          <button className="btn-save" style={{ width: 'auto', padding: '10px 20px' }} onClick={handleAddOrder}>Add</button>
        </div>
      </div>

      {showModal && (
        <PromoModal
          promo={editingPromo}
          onClose={() => { setShowModal(false); setEditingPromo(null) }}
        />
      )}
    </div>
  )
}

function PromoModal({ promo, onClose }) {
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
        await supabase.from('promotions').update(form).eq('id', promo.id)
      } else {
        await supabase.from('promotions').insert(form)
      }
      onClose()
    } catch (err) {
      console.error('Error saving promotion:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <div style={{ padding: '32px' }}>
        <h2 className="section-header" style={{ marginBottom: 24 }}>
          {promo ? 'Edit Promotion' : 'New Promotion'}
        </h2>

        <div className="form-group">
          <label className="form-label">Name</label>
          <input type="text" value={form.name} onChange={(e) => update('name', e.target.value)}
            placeholder="Mother's Day Sale" style={{ width: '100%' }} />
        </div>

        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Start Date</label>
            <input type="date" value={form.start_date} onChange={(e) => update('start_date', e.target.value)} style={{ width: '100%' }} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">End Date</label>
            <input type="date" value={form.end_date} onChange={(e) => update('end_date', e.target.value)} style={{ width: '100%' }} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Discount / Offer</label>
          <input type="text" value={form.discount} onChange={(e) => update('discount', e.target.value)}
            placeholder="20% off everything" style={{ width: '100%' }} />
        </div>

        <div className="form-group">
          <label className="form-label">Platforms</label>
          <div className="pill-group">
            {PLATFORM_OPTIONS.map(p => (
              <button key={p} className={`pill ${form.platforms.includes(p) ? 'active' : ''}`}
                onClick={() => togglePlatform(p)}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Color</label>
          <div className="color-picker">
            {PROMO_COLORS.map(c => (
              <button key={c} className={`color-swatch ${form.color === c ? 'selected' : ''}`}
                style={{ background: c }} onClick={() => update('color', c)} />
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea rows={3} value={form.notes} onChange={(e) => update('notes', e.target.value)}
            placeholder="Campaign details..." style={{ width: '100%' }} />
        </div>

        <div className="form-group">
          <label className="form-label">Status</label>
          <div className="pill-group">
            {['upcoming', 'active', 'ended'].map(s => (
              <button key={s} className={`pill ${form.status === s ? 'active' : ''}`}
                onClick={() => update('status', s)}>{s}</button>
            ))}
          </div>
        </div>

        <button className="btn-save" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </Modal>
  )
}
