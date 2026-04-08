import { useState, useCallback } from 'react'
import { format, parseISO, addDays } from 'date-fns'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'
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
  const [statFilter, setStatFilter] = useState(null)

  const fetchPromos = useCallback(() =>
    supabase.from('promotions').select('*').order('start_date'),
    []
  )

  const { data: promotions, setData: setPromotions, loading: promosLoading } = useRealtime('promotions', fetchPromos)

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
    if (!error && data?.[0]) {
      logAudit({ table: 'promotions', action: 'insert', recordId: data[0].id, summary: `Duplicated promotion: "${rest.name} (Copy)"` })
      setPromotions(prev => [...prev, data[0]])
    }
  }

  const handleArchive = async (promo) => {
    const { data, error } = await supabase.from('promotions').update({ status: 'ended' }).eq('id', promo.id).select()
    if (!error && data?.[0]) {
      logAudit({ table: 'promotions', action: 'update', recordId: promo.id, summary: `Archived promotion: "${promo.name}"` })
      setPromotions(prev => prev.map(p => p.id === promo.id ? data[0] : p))
    }
  }

  const deletePromotion = async (id) => {
    if (!window.confirm('Delete this promotion?')) return
    const promo = promotions.find(p => p.id === id)
    const { error } = await supabase.from('promotions').delete().eq('id', id)
    if (!error) {
      logAudit({ table: 'promotions', action: 'delete', recordId: id, summary: `Deleted promotion: "${promo?.name || '?'}"` })
      setPromotions(prev => prev.filter(p => p.id !== id))
    }
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
            transition: 'all 0.25s ease', whiteSpace: 'nowrap',
          }}>
          + Add Promotion
        </button>
      </PageHeader>

      <div className="page-container" onClick={() => statFilter && setStatFilter(null)}>
        <MonthSelector />

        {/* Stats — chic clickable cards */}
        <div className="promo-stats-grid" style={{ marginBottom: 48 }}>
          {[
            { label: 'Active Now', value: stats.active, key: 'active', accent: '#F2C4CE', bg: '#FEF7F9', bgHover: '#FDF0F3' },
            { label: 'Upcoming', value: stats.upcoming, key: 'upcoming', accent: '#E8A0B2', bg: '#FDF0F4', bgHover: '#FBE4EB' },
            { label: 'This Month', value: stats.thisMonth, key: 'thisMonth', accent: '#D4849A', bg: '#FCE8EF', bgHover: '#F9D6E1' },
            { label: 'Total', value: stats.total, key: 'total', accent: '#B85C78', bg: '#FADCE5', bgHover: '#F5C8D6' },
          ].map((s) => (
            <div key={s.label} onClick={(e) => { e.stopPropagation(); setStatFilter(statFilter === s.key ? null : s.key) }}
              style={{
                padding: '32px 20px', textAlign: 'center', cursor: 'pointer',
                backgroundColor: statFilter === s.key ? s.bgHover : s.bg,
                borderBottom: `3px solid ${statFilter === s.key ? s.accent : 'transparent'}`,
                borderTop: `1px solid ${s.accent}18`,
                transition: 'all 0.25s cubic-bezier(0.16,1,0.32,1)',
                boxShadow: statFilter === s.key ? `0 6px 24px ${s.accent}25` : 'none',
              }}>
              <div style={{ fontSize: 36, fontWeight: 500, color: s.accent, lineHeight: 1, marginBottom: 12, fontFamily: "'Inter', system-ui, sans-serif" }}>{s.value}</div>
              <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', color: statFilter === s.key ? s.accent : 'var(--ink-light)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Stat filter slide-up panel — clicking outside (on page-container) closes it */}
        {statFilter && (() => {
          const filtered = statFilter === 'active' ? promotions.filter(p => getPromoStatus(p) === 'active')
            : statFilter === 'upcoming' ? promotions.filter(p => getPromoStatus(p) === 'upcoming')
            : statFilter === 'thisMonth' ? monthPromos
            : promotions
          const title = statFilter === 'active' ? 'Active Now' : statFilter === 'upcoming' ? 'Upcoming' : statFilter === 'thisMonth' ? 'This Month' : 'All Promotions'
          return (
            <div onClick={e => e.stopPropagation()} style={{
              marginBottom: 32, padding: '24px 0', borderBottom: '1px solid var(--cream-deep)',
              animation: 'fadeSlideUp 300ms cubic-bezier(0.16,1,0.32,1)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--ink-light)' }}>{title} ({filtered.length})</span>
                <button onClick={() => setStatFilter(null)} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--ink-light)', cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
              {filtered.length === 0 && <p style={{ fontSize: 13, fontWeight: 300, color: 'var(--ink-light)' }}>None found</p>}
              {filtered.map(p => (
                <div key={p.id} style={{
                  padding: '14px 0', borderBottom: '1px solid var(--cream-deep)',
                  borderLeft: `2px solid ${p.color || '#F4A7B9'}`, paddingLeft: 16,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{p.name}</div>
                    <div style={{ fontSize: 11, fontWeight: 300, color: 'var(--ink-light)', marginTop: 2 }}>
                      {p.start_date && format(new Date(p.start_date + 'T00:00:00'), 'MMM d')}
                      {p.end_date && ` – ${format(new Date(p.end_date + 'T00:00:00'), 'MMM d, yyyy')}`}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 9, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase',
                    padding: '3px 12px', borderRadius: 20,
                    ...(getPromoStatus(p) === 'active' ? { backgroundColor: '#FDE8EE', color: '#D4849A' }
                      : getPromoStatus(p) === 'upcoming' ? { backgroundColor: '#F0EBF5', color: '#9B8AAE' }
                      : { backgroundColor: '#F0EDE8', color: '#A89888' })
                  }}>{getPromoStatus(p)}</span>
                </div>
              ))}
            </div>
          )
        })()}

        {/* Timeline — thin editorial line */}
        {!statFilter && <div style={{ marginBottom: 48 }}>
          <div style={{ height: 1, backgroundColor: 'var(--cream-deep)', width: '100%' }} />
        </div>}

        {/* Promotions — flat rows */}
        {!statFilter && <div style={{ marginBottom: 48 }}>
          {promosLoading && <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ink-light)', padding: '24px 0', textAlign: 'center' }}>Loading...</p>}
          {!promosLoading && monthPromos.length === 0 && <p style={{ fontSize: 13, fontWeight: 300, color: 'var(--ink-light)', padding: '24px 0' }}>No promotions this month</p>}
          {monthPromos.map(promo => {
            const computedStatus = getPromoStatus(promo)
            const statusStyle = computedStatus === 'active'
              ? { backgroundColor: '#FDE8EE', color: '#D4849A' }
              : computedStatus === 'upcoming'
              ? { backgroundColor: '#F0EBF5', color: '#9B8AAE' }
              : { backgroundColor: '#F0EDE8', color: '#A89888' }
            return (
              <SwipeToDelete key={promo.id} onDelete={() => deletePromotion(promo.id)}>
                <div style={{
                  padding: '14px 0', paddingLeft: 16, paddingRight: 16,
                  borderBottom: '1px solid var(--cream-deep)',
                  borderLeft: `2px solid ${promo.color || '#F4A7B9'}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  transition: 'all 0.2s ease',
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{promo.name}</div>
                    <div style={{ fontSize: 11, fontWeight: 300, color: 'var(--ink-light)', marginTop: 2 }}>
                      {promo.start_date && format(new Date(promo.start_date + 'T00:00:00'), 'MMM d')}
                      {promo.end_date && ` \u2013 ${format(new Date(promo.end_date + 'T00:00:00'), 'MMM d, yyyy')}`}
                      {promo.discount && <span style={{ marginLeft: 10, color: '#D4849A', backgroundColor: '#FDE8EE', padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 500 }}>{promo.discount}</span>}
                    </div>
                    {promo.notes && <div style={{ fontSize: 12, fontWeight: 300, color: 'var(--ink-mid)', marginTop: 4 }}>{promo.notes}</div>}
                    <div style={{ marginTop: 8, display: 'flex', gap: 4, fontSize: 10, fontWeight: 400, color: 'var(--ink-light)' }}>
                      <button style={{ background: 'none', border: 'none', fontSize: 10, fontWeight: 400, color: 'var(--ink-light)', padding: 0, transition: 'color 0.2s', cursor: 'pointer' }}
                        onClick={() => handleEdit(promo)} onMouseEnter={e => e.target.style.color = 'var(--ink)'} onMouseLeave={e => e.target.style.color = 'var(--ink-light)'}>Edit</button>
                      <span style={{ color: 'var(--cream-deep)' }}>&middot;</span>
                      <button style={{ background: 'none', border: 'none', fontSize: 10, fontWeight: 400, color: 'var(--ink-light)', padding: 0, transition: 'color 0.2s', cursor: 'pointer' }}
                        onClick={() => handleDuplicate(promo)} onMouseEnter={e => e.target.style.color = 'var(--ink)'} onMouseLeave={e => e.target.style.color = 'var(--ink-light)'}>Duplicate</button>
                      <span style={{ color: 'var(--cream-deep)' }}>&middot;</span>
                      <button style={{ background: 'none', border: 'none', fontSize: 10, fontWeight: 400, color: 'var(--ink-light)', padding: 0, transition: 'color 0.2s', cursor: 'pointer' }}
                        onClick={() => deletePromotion(promo.id)} onMouseEnter={e => e.target.style.color = '#B85450'} onMouseLeave={e => e.target.style.color = 'var(--ink-light)'}>Delete</button>
                    </div>
                  </div>
                  <span style={{ ...statusStyle, borderRadius: 20, padding: '3px 12px', fontSize: 9, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase', flexShrink: 0 }}>
                    {computedStatus}
                  </span>
                </div>
              </SwipeToDelete>
            )
          })}
        </div>}

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
        if (!error && data?.[0]) {
          logAudit({ table: 'promotions', action: 'update', recordId: promo.id, summary: `Updated promotion: "${form.name}"`, details: form })
          setPromotions(prev => prev.map(p => p.id === promo.id ? data[0] : p))
        }
      } else {
        const { data, error } = await supabase.from('promotions').insert(form).select()
        if (!error && data?.[0]) {
          logAudit({ table: 'promotions', action: 'insert', recordId: data[0].id, summary: `Created promotion: "${form.name}"`, details: form })
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
        <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', fontSize: 22, color: 'var(--ink-light)', lineHeight: 1, padding: 4, transition: 'color 0.2s', cursor: 'pointer' }}
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
