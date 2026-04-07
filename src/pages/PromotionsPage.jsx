import { useState, useCallback } from 'react'
import { format, parseISO, addDays } from 'date-fns'
import { supabase } from '../lib/supabase'
import { sendNotification } from '../components/Notifications'
import SwipeToDelete from '../components/SwipeToDelete'
import { useMonth } from '../hooks/useMonth'
import { useRealtime } from '../hooks/useRealtime'
import PageHeader from '../components/PageHeader'
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

  const getPromoStatus = (p) => {
    if (!p.start_date || !p.end_date) return p.status || 'upcoming'
    if (p.end_date < todayStr) return 'ended'
    if (p.start_date <= todayStr && p.end_date >= todayStr) return 'active'
    if (p.start_date > todayStr) return 'upcoming'
    return p.status || 'upcoming'
  }

  const stats = {
    active: promotions.filter(p => getPromoStatus(p) === 'active').length,
    upcoming: promotions.filter(p => getPromoStatus(p) === 'upcoming').length,
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
      <PageHeader title="Promotions">
        <button onClick={() => { setEditingPromo(null); setShowModal(true) }}
          style={{
            backgroundColor: 'var(--ink)', color: 'var(--cream)', border: 'none',
            borderRadius: 9999, padding: '12px 32px', fontSize: 11, fontWeight: 500,
            letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'Inter, sans-serif',
            transition: 'all 0.2s ease', whiteSpace: 'nowrap',
          }}>
          + Add Promotion
        </button>
      </PageHeader>

      <div className="page-container">
        <MonthSelector />

        {/* Stats — borderless inline */}
        <div style={{ display: 'flex', gap: 0, borderTop: '1px solid var(--cream-deep)', borderBottom: '1px solid var(--cream-deep)', marginBottom: 48 }}>
          {[
            { label: 'Active Now', value: stats.active },
            { label: 'Upcoming', value: stats.upcoming },
            { label: 'This Month', value: stats.thisMonth },
            { label: 'Total', value: stats.total },
          ].map((s, i) => (
            <div key={s.label} style={{ flex: 1, padding: '32px 0', textAlign: 'center', borderRight: i < 3 ? '1px solid var(--cream-deep)' : 'none' }}>
              <div style={{ fontSize: 36, fontWeight: 300, color: 'var(--ink)', lineHeight: 1, marginBottom: 8 }}>{s.value}</div>
              <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--ink-light)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Timeline — thin editorial line */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ height: 1, backgroundColor: 'var(--cream-deep)', width: '100%' }} />
        </div>

        {/* Promotions — flat rows */}
        <div style={{ marginBottom: 48 }}>
          {monthPromos.length === 0 && <p style={{ fontSize: 13, fontWeight: 300, color: 'var(--ink-light)', padding: '24px 0' }}>No promotions this month</p>}
          {monthPromos.map(promo => {
            const computedStatus = getPromoStatus(promo)
            const statusStyle = computedStatus === 'active'
              ? { backgroundColor: 'var(--pink-light)', color: 'var(--pink-deep)' }
              : computedStatus === 'upcoming'
              ? { backgroundColor: 'var(--cream-mid)', color: 'var(--ink-mid)' }
              : { backgroundColor: 'var(--cream-deep)', color: 'var(--ink-light)' }
            return (
              <SwipeToDelete key={promo.id} onDelete={() => deletePromotion(promo.id)}>
                <div style={{
                paddingTop: 24, paddingBottom: 24,
                borderBottom: '1px solid var(--cream-deep)',
                borderLeft: `2px solid ${promo.color || '#F4A7B9'}`,
                backgroundColor: 'var(--cream)',
                paddingLeft: 20,
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)' }}>{promo.name}</div>
                  <div style={{ fontSize: 12, fontWeight: 300, color: 'var(--ink-light)', marginTop: 4 }}>
                    {promo.start_date && format(new Date(promo.start_date + 'T00:00:00'), 'MMM d')}
                    {promo.end_date && ` \u2013 ${format(new Date(promo.end_date + 'T00:00:00'), 'MMM d, yyyy')}`}
                    {promo.discount && <span style={{ marginLeft: 12, color: 'var(--pink-deep)' }}>{promo.discount}</span>}
                  </div>
                  {promo.notes && <div style={{ fontSize: 13, fontWeight: 300, color: 'var(--ink-mid)', marginTop: 8 }}>{promo.notes}</div>}
                  <div style={{ marginTop: 12, display: 'flex', gap: 4, fontSize: 11, fontWeight: 400, color: 'var(--ink-light)' }}>
                    <button style={{ background: 'none', border: 'none', fontSize: 11, fontWeight: 400, color: 'var(--ink-light)', padding: 0, transition: 'color 0.2s' }}
                      onClick={() => handleEdit(promo)} onMouseEnter={e => e.target.style.color = 'var(--ink)'} onMouseLeave={e => e.target.style.color = 'var(--ink-light)'}>Edit</button>
                    <span style={{ color: 'var(--cream-deep)' }}>&middot;</span>
                    <button style={{ background: 'none', border: 'none', fontSize: 11, fontWeight: 400, color: 'var(--ink-light)', padding: 0, transition: 'color 0.2s' }}
                      onClick={() => handleDuplicate(promo)} onMouseEnter={e => e.target.style.color = 'var(--ink)'} onMouseLeave={e => e.target.style.color = 'var(--ink-light)'}>Duplicate</button>
                    <span style={{ color: 'var(--cream-deep)' }}>&middot;</span>
                    <button style={{ background: 'none', border: 'none', fontSize: 11, fontWeight: 400, color: 'var(--ink-light)', padding: 0, transition: 'color 0.2s' }}
                      onClick={() => deletePromotion(promo.id)} onMouseEnter={e => e.target.style.color = '#B85450'} onMouseLeave={e => e.target.style.color = 'var(--ink-light)'}>Delete</button>
                  </div>
                </div>
                <span style={{ ...statusStyle, borderRadius: 20, padding: '4px 14px', fontSize: 10, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase', flexShrink: 0 }}>
                  {computedStatus}
                </span>
                </div>
              </SwipeToDelete>
            )
          })}
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
              padding: '6px 16px', borderRadius: 20, border: 'none',
              backgroundColor: isActive ? 'var(--ink)' : 'var(--cream-mid)',
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
              padding: '6px 16px', borderRadius: 20, border: 'none',
              backgroundColor: isActive ? 'var(--ink)' : 'var(--cream-mid)',
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
  const [startOpen, setStartOpen] = useState(false)
  const [endOpen, setEndOpen] = useState(false)

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
        if (!error && data?.[0]) {
          setPromotions(prev => [...prev, data[0]])
          // Notify the other user about new promotion
          const currentUser = localStorage.getItem('harper-user') || 'natalie'
          const otherUser = currentUser === 'natalie' ? 'grace' : 'natalie'
          sendNotification({
            to: otherUser,
            from: currentUser,
            type: 'promotion',
            title: `created a new promotion: "${form.name}"`,
            body: form.discount ? `${form.discount} — ${form.start_date || ''} to ${form.end_date || ''}` : '',
            link: '/promotions',
          })
        }
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
            <DatePicker label="Start Date" value={form.start_date}
              isOpen={startOpen} onOpen={() => setStartOpen(true)} onClose={() => setStartOpen(false)}
              onChange={(v) => {
                update('start_date', v)
                // If end date is empty or before new start, suggest one week later
                if (!form.end_date || form.end_date <= v) {
                  update('end_date', format(addDays(new Date(v + 'T12:00:00'), 7), 'yyyy-MM-dd'))
                }
                setStartOpen(false)
                setTimeout(() => setEndOpen(true), 150)
              }} />
          </div>
          <div style={{ flex: 1 }}>
            <DatePicker label="End Date" value={form.end_date} minDate={form.start_date}
              isOpen={endOpen} onOpen={() => setEndOpen(true)} onClose={() => setEndOpen(false)}
              onChange={(v) => { update('end_date', v); setEndOpen(false) }} />
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
