import { format } from 'date-fns'
import './PromotionCard.css'

export default function PromotionCard({ promotion, onEdit, onDuplicate, onArchive, onDelete }) {
  return (
    <div className="promotion-card" style={{ borderLeftColor: promotion.color || '#F4A7B9' }}>
      <div style={{ flex: 1 }}>
        <div className="promo-name">{promotion.name}</div>

        <div className="promo-details">
          <span className="promo-dates">
            {promotion.start_date && format(new Date(promotion.start_date + 'T00:00:00'), 'MMM d')}
            {promotion.end_date && ` \u2013 ${format(new Date(promotion.end_date + 'T00:00:00'), 'MMM d, yyyy')}`}
          </span>
          {promotion.discount && (
            <span className="promo-discount">{promotion.discount}</span>
          )}
        </div>

        {promotion.platforms && promotion.platforms.length > 0 && (
          <div className="promo-platforms">
            {promotion.platforms.map(p => (
              <span key={p} className="platform-chip">{p}</span>
            ))}
          </div>
        )}

        {promotion.notes && <p className="promo-notes">{promotion.notes}</p>}

        <div className="promo-actions">
          {onEdit && <button className="promo-action" onClick={() => onEdit(promotion)}>Edit</button>}
          {onEdit && <span style={{ color: 'var(--cream-deep)' }}>&middot;</span>}
          {onDuplicate && <button className="promo-action" onClick={() => onDuplicate(promotion)}>Duplicate</button>}
          {onDuplicate && <span style={{ color: 'var(--cream-deep)' }}>&middot;</span>}
          {onDelete && (
            <button className="promo-action promo-delete-action" onClick={() => onDelete(promotion.id)}>Delete</button>
          )}
        </div>
      </div>

      <span className={`status-chip ${promotion.status || 'upcoming'}`}>
        {promotion.status || 'upcoming'}
      </span>
    </div>
  )
}
