import './PageHeader.css'

export default function PageHeader({ title, children }) {
  return (
    <div className="page-header">
      <h1 className="page-title">{title}</h1>
      {children && <div className="page-header-actions">{children}</div>}
    </div>
  )
}
