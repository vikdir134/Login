// src/components/Modal.jsx
export default function Modal({ open, title, children, onClose, maxWidth = 700 }) {
  if (!open) return null
  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,.45)',
      display:'grid', placeItems:'center', zIndex:99
    }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={e=>e.stopPropagation()}
        style={{
          width:'min(92vw, '+maxWidth+'px)',
          background:'var(--surface)', color:'var(--text)',
          border:'1px solid var(--border)', borderRadius:16, boxShadow:'var(--shadow)',
          padding:20
        }}
      >
        <header style={{display:'flex',justifyContent:'space-between',alignItems:'center', marginBottom:8}}>
          <h4 style={{margin:0}}>{title}</h4>
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </header>
        {children}
      </div>
    </div>
  )
}
