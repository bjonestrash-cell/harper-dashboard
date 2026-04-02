import { format } from 'date-fns'
import './PromotionCard.css'

export default function PromotionCard({ promotion, onEdit, onDuplicate, onArchive, onDelete }) {
  const platformLabels = {
    instagram: 'Instagram',
    tiktok: 'TikTok',
    email: 'Email',
  }

  return (
    <div className="promotion-card" style={{ borderLeftColor: promotion.color || '#F4A7B9' }}>
      <div className="promo-header">
        <h3 className="promo-name">{promotion.name}</h3>
        <span className={`status-chip ${promotion.status}`}>{promotion.status}</span>
      </div>

      <div className="promo-details">
        <div className="promo-dates caption">
          {promotion.start_date && format(new Date(promotion.start_date + 'T00:00:00'), 'MMM d')}
          {promotion.end_date && ` \u2013 ${format(new Date(promotion.end_date + 'T00:00:00'), 'MMM d, yyyy')}`}
        </div>

        {promotion.discount && (
          <span className="promo-discount">{promotion.discount}</span>
        )}
      </div>

      {promotion.platforms && promotion.platforms.length > 0 && (
        <div className="promo-platforms">
          {promotion.platforms.map(p => (
            <span key={p} className="platform-chip">{platformLabels[p] || p}</span>
          ))}
        </div>
      )}

      {promotion.notes && (
        <p className="promo-notes">{promotion.notes}</p>
      )}

      <div className="promo-actions">
        <button className="promo-action" onClick={() => onEdit(promotion)}>Edit</button>
        <button className="promo-action" onClick={() => onDuplicate(promotion)}>Duplicate</button>
        <button className="promo-action" onClick={() => onArchive(promotion)}>Archive</button>
        {onDelete && (
          <button className="promo-action promo-delete-action"
            onClick={() => onDelete(promotion.id)}
          >Delete</button>
        )}
      </div>
    </div>
  )
}
