import { useEffect, useMemo, useState } from 'react'

export default function DeliveryModal({ open, onClose, lines, onSubmit }) {
  // lines: [{ id, productName, pedido, entregado, pendiente }]
  const [lineId, setLineId] = useState('')
  const [peso, setPeso] = useState('')
  const [facturaId, setFacturaId] = useState('')
  const [desc, setDesc] = useState('')

  useEffect(() => {
    if (!open) return
    const first = lines.find(l => l.pendiente > 0) || lines[0]
    setLineId(first ? String(first.id) : '')
    setPeso('')
    setFacturaId('')
    setDesc('')
  }, [open, lines])

  const sel = useMemo(() => lines.find(l => String(l.id) === String(lineId)), [lines, lineId])
  const pesoNum = Number(peso || 0)
  const excede = sel ? pesoNum > sel.pendiente + 1e-9 : false
  const disabled = !sel || !pesoNum || pesoNum <= 0 || excede

  const submit = (e) => {
    e.preventDefault()
    if (disabled) return
    onSubmit({
      descriptionOrderId: Number(lineId),
      peso: Number(peso),
      facturaId: facturaId ? Number(facturaId) : null,
      descripcion: desc || null
    })
  }

  if (!open) return null
  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,.35)',
      display:'grid', placeItems:'center', zIndex:1000
    }}>
      <div className="card" style={{ maxWidth:560, width:'100%', background:'var(--surface)' }}>
        <h4 style={{ marginTop:0 }}>Registrar entrega</h4>
        <form onSubmit={submit} className="form-row" style={{ gridTemplateColumns:'2fr 1fr 1fr auto' }}>
          <label className="form-field">
            <span>Línea de pedido</span>
            <select value={lineId} onChange={e=>setLineId(e.target.value)}>
              {lines.map(l => (
                <option key={l.id} value={l.id}>
                  {l.productName} — Pendiente: {l.pendiente.toFixed(2)} kg
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Peso (kg)</span>
            <input type="number" step="0.01" min="0.01" value={peso} onChange={e=>setPeso(e.target.value)} />
          </label>
          <label className="form-field">
            <span>Factura (opcional)</span>
            <input type="number" min="1" value={facturaId} onChange={e=>setFacturaId(e.target.value)} placeholder="ID_FACTURA" />
          </label>
          <div className="form-actions">
            <button className="btn" disabled={disabled}>Guardar</button>
          </div>
        </form>

        <label style={{ display:'block', marginTop:10 }}>
          <span className="muted" style={{ display:'block', marginBottom:6 }}>Descripción (opcional)</span>
          <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Nota de entrega" />
        </label>

        {sel && excede && (
          <div className="error" style={{ marginTop:10 }}>
            No puedes exceder lo pendiente ({sel.pendiente.toFixed(2)} kg).
          </div>
        )}

        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:16 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
