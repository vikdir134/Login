export default function Modal({ open, title, children, onClose, wide = false }) {
  if (!open) return null
  return (
    <div style={overlay}>
      <div style={{ ...panel, maxWidth: wide ? 720 : 520 }}>
        <div style={hdr}>
          <strong>{title}</strong>
          <button onClick={onClose} className="btn-secondary" style={{ height: 36 }}>✕</button>
        </div>
        <div style={{ paddingTop: 8 }}>{children}</div>
      </div>
    </div>
  )
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
  display: 'grid', placeItems: 'center', zIndex: 50
}
const panel = {
  width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 14, boxShadow: 'var(--shadow)', padding: 16
}
const hdr = { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
