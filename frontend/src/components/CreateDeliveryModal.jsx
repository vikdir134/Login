// src/components/CreateDeliveryModal.jsx
import { useEffect, useMemo, useState } from 'react'
import { getEffectivePrice } from '../api/prices'
import { createDelivery } from '../api/deliveries'

const fmtKg = n => (Number(n)||0).toFixed(2)
const fmtMoney = n => (Number(n)||0).toFixed(2)

export default function CreateDeliveryModal({ open, onClose, order, onDone }) {
  const [rows, setRows] = useState([
    { descriptionOrderId:'', peso:'', unitPrice:'', currency:'PEN', descripcion:'' }
  ])
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')

  const productos = useMemo(() => {
    const m = new Map()
    for (const l of order?.lines || []) {
      if (!m.has(l.productId)) m.set(l.productId, l.productName)
    }
    return Array.from(m, ([id, name]) => ({ id, name }))
  }, [order])

  // Para cada fila, cuando elijo una línea (ID_DESCRIPTION_ORDER), si no hay unitPrice, sugiero
  const lineMap = useMemo(() => {
    const m = new Map()
    for (const l of order?.lines || []) m.set(String(l.id), l)
    return m
  }, [order])

  useEffect(() => {
    if (!open) return
    setRows([{ descriptionOrderId:'', peso:'', unitPrice:'', currency:'PEN', descripcion:'' }])
    setMsg('')
    setSending(false)
  }, [open])

  const setRow = (i, patch) => {
    setRows(rs => rs.map((r, idx) => idx===i ? { ...r, ...patch } : r))
  }
  const addRow = () => setRows(rs => [...rs, { descriptionOrderId:'', peso:'', unitPrice:'', currency:'PEN', descripcion:'' }])
  const removeRow = (i) => setRows(rs => rs.filter((_, idx) => idx !== i))

  const canSubmit = useMemo(() => {
    if (!rows.length) return false
    for (const r of rows) {
      if (!r.descriptionOrderId) return false
      if (!(Number(r.peso) > 0)) return false
      const line = lineMap.get(String(r.descriptionOrderId))
      if (!line) return false
      if (Number(r.peso) > Number(line.pendiente || 0) + 1e-9) return false
      if (r.unitPrice === '' || isNaN(Number(r.unitPrice))) return false
    }
    return true
  }, [rows, lineMap])

  const subtotalTotal = rows.reduce((a, r) => a + (Number(r.peso)||0) * (Number(r.unitPrice)||0), 0)

  const onPickLine = async (i, descriptionOrderId) => {
    setRow(i, { descriptionOrderId })
    const line = lineMap.get(String(descriptionOrderId))
    if (!line) return
    // si no hay precio en la fila, sugerir el efectivo para ese producto
    const eff = await getEffectivePrice({ customerId: order.customerId, productId: line.productId })
    if (eff && (rows[i].unitPrice === '' || rows[i].unitPrice == null)) {
      setRow(i, { unitPrice: String(eff.price ?? 0), currency: eff.currency || 'PEN' })
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSending(true); setMsg('')
    try {
      await createDelivery(order.id, {
        facturaId: null,
        lines: rows.map(r => ({
          descriptionOrderId: Number(r.descriptionOrderId),
          peso: Number(r.peso),
          descripcion: r.descripcion || null,
          unitPrice: Number(r.unitPrice),
          currency: r.currency || 'PEN'
        }))
      })
      onDone?.()
    } catch (err) {
      console.error('CreateDelivery error:', err?.response?.data || err)
      setMsg(err?.response?.data?.error || 'Error creando entrega')
    } finally {
      setSending(false)
    }
  }

  if (!open) return null
  return (
    <div className="modal modal--center">
      <div className="modal__overlay" onClick={onClose} />
      <div className="modal__panel">
        <div className="modal__head">
          <h4 className="modal__title">Nueva entrega (múltiples líneas)</h4>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={submit} className="form-col" style={{ gap:12 }}>
          {rows.map((r, i) => {
            const line = lineMap.get(String(r.descriptionOrderId))
            return (
              <div key={i} className="form-row" style={{ gridTemplateColumns:'2fr 1fr 1fr 1fr auto' }}>
                <label className="form-field">
                  <span>Línea (producto · presentación)</span>
                  <select
                    value={r.descriptionOrderId}
                    onChange={(e)=>onPickLine(i, e.target.value)}
                    required
                  >
                    <option value="">—</option>
                    {(order?.lines || []).map(l => (
                      <option key={l.id} value={l.id}>
                        {l.productName} · {l.presentacion ?? '—'} · Pend {fmtKg(l.pendiente)} kg
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <span>Peso (kg)</span>
                  <input type="number" step="0.01" min="0.01" value={r.peso} onChange={e=>setRow(i,{peso:e.target.value})} required />
                  {line && Number(r.peso) > Number(line.pendiente) && (
                    <div className="muted" style={{ color:'#c00' }}>Max {fmtKg(line.pendiente)} kg</div>
                  )}
                </label>

                <label className="form-field">
                  <span>Precio unit.</span>
                  <input type="number" step="0.01" min="0" value={r.unitPrice} onChange={e=>setRow(i,{unitPrice:e.target.value})} />
                </label>

                <label className="form-field">
                  <span>Moneda</span>
                  <select value={r.currency} onChange={e=>setRow(i,{currency:e.target.value})}>
                    <option value="PEN">PEN</option>
                    <option value="USD">USD</option>
                  </select>
                </label>

                <div className="form-actions">
                  {rows.length > 1 && (
                    <button type="button" className="btn-secondary" onClick={()=>removeRow(i)}>Quitar</button>
                  )}
                </div>

                <label className="form-field" style={{ gridColumn:'1 / -1' }}>
                  <span>Descripción (opcional)</span>
                  <input value={r.descripcion} onChange={e=>setRow(i,{descripcion:e.target.value})} maxLength={50} />
                </label>
              </div>
            )
          })}

          <button type="button" className="btn-secondary" onClick={addRow}>+ Línea</button>

          <div className="muted">Subtotal estimado: <b>{fmtMoney(subtotalTotal)}</b></div>

          {msg && <div className="error">{msg}</div>}

          <div className="modal__actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn" disabled={!canSubmit || sending}>{sending ? 'Guardando…' : 'Registrar entrega'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
