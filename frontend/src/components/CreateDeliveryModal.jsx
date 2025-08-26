import { useEffect, useMemo, useState } from 'react'
import { getEffectivePrice } from '../api/prices'
import { createDelivery } from '../api/deliveries'
import { createInvoice } from '../api/invoices' // <-- necesitas este helper (ver nota al final)

const fmtKg = n => (Number(n)||0).toFixed(2)
const fmtMoney = n => (Number(n)||0).toFixed(2)

export default function CreateDeliveryModal({ open, onClose, order, onDone }) {
  const [rows, setRows] = useState([
    { descriptionOrderId:'', peso:'', unitPrice:'', currency:'PEN', descripcion:'' }
  ])
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')

  // ===== Factura opcional (tu tabla: ID_FACTURA, CODIGO, CREATED_AT) =====
  const [makeInvoice, setMakeInvoice] = useState(false)
  const [invoiceCode, setInvoiceCode] = useState('')

  // Mapa de líneas para validar pendiente / sugerir precio
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
    setMakeInvoice(false)
    setInvoiceCode('')
  }, [open])

  const setRow = (i, patch) =>
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const addRow = () =>
    setRows(rs => [...rs, { descriptionOrderId:'', peso:'', unitPrice:'', currency:'PEN', descripcion:'' }])

  const removeRow = (i) =>
    setRows(rs => rs.filter((_, idx) => idx !== i))

  const canSubmit = useMemo(() => {
    if (!rows.length) return false
    for (const r of rows) {
      if (!r.descriptionOrderId) return false
      if (!(Number(r.peso) > 0)) return false
      const line = lineMap.get(String(r.descriptionOrderId))
      if (!line) return false
      if (Number(r.peso) > Number(line.pendiente || 0) + 1e-9) return false
      // precio vacío => usa “vigente”; si escribe, debe ser número
      if (r.unitPrice !== '' && r.unitPrice != null && isNaN(Number(r.unitPrice))) return false
    }
    if (makeInvoice && !invoiceCode.trim()) return false
    return true
  }, [rows, lineMap, makeInvoice, invoiceCode])

  const subtotalTotal = rows.reduce(
    (a, r) => a + (Number(r.peso)||0) * (Number(r.unitPrice||0)||0),
    0
  )

  const onPickLine = async (i, descriptionOrderId) => {
    setRow(i, { descriptionOrderId })
    const line = lineMap.get(String(descriptionOrderId))
    if (!line) return
    // si no hay precio en la fila, sugerir vigente del cliente-producto
    if (rows[i].unitPrice === '' || rows[i].unitPrice == null) {
      const eff = await getEffectivePrice({ customerId: order.customerId, productId: line.productId })
      if (eff) {
        setRow(i, {
          unitPrice: eff.price != null ? String(eff.price) : '',
          currency: eff.currency || 'PEN'
        })
      }
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSending(true); setMsg('')

    try {
      // 1) Crear factura si aplica -> obtener facturaId
      let facturaId = null
      if (makeInvoice) {
        const inv = await createInvoice({
          customerId: order.customerId,
          code: invoiceCode.trim()
        }) // debe devolver { id, ... }
        facturaId = inv?.id || null
      }

      // 2) Normalizar líneas
      const lines = rows.map(r => ({
        descriptionOrderId: Number(r.descriptionOrderId),
        peso: Number(r.peso),
        descripcion: r.descripcion || null,
        // si dejó el precio vacío => backend tomará “vigente” y a la vez NO actualiza lista de precios
        unitPrice: (r.unitPrice==='' || r.unitPrice==null) ? undefined : Number(r.unitPrice),
        currency: r.currency || 'PEN'
      }))

      // 3) Crear entrega
      await createDelivery(order.id, { facturaId, lines })
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
          {/* ====== FACTURA OPCIONAL ====== */}
          <div className="card" style={{ background:'transparent', border:'1px dashed var(--border)' }}>
            <label className="form-switch" style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input
                type="checkbox"
                checked={makeInvoice}
                onChange={e=>setMakeInvoice(e.target.checked)}
              />
              <span>Crear factura ahora</span>
            </label>
            {makeInvoice && (
              <div className="form-row" style={{ gridTemplateColumns:'1fr' }}>
                <label className="form-field">
                  <span>Código de factura</span>
                  <input
                    value={invoiceCode}
                    onChange={e=>setInvoiceCode(e.target.value)}
                    placeholder="Ej: F001-000123"
                    required
                  />
                </label>
              </div>
            )}
          </div>

          {/* ====== LÍNEAS ====== */}
          <div className="muted">Líneas de la entrega</div>
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
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={r.peso}
                    onChange={e=>setRow(i,{peso:e.target.value})}
                    required
                  />
                  {line && Number(r.peso) > Number(line.pendiente) && (
                    <div className="muted" style={{ color:'#c00' }}>
                      Max {fmtKg(line.pendiente)} kg
                    </div>
                  )}
                </label>

                <label className="form-field">
                  <span>Precio unit.</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={r.unitPrice}
                    onChange={e=>setRow(i,{unitPrice:e.target.value})}
                    placeholder="vacío = precio vigente"
                  />
                </label>

                <label className="form-field">
                  <span>Moneda</span>
                  <select
                    value={r.currency}
                    onChange={e=>setRow(i,{currency:e.target.value})}
                  >
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
                  <span>Comentario</span>
                  <input
                    value={r.descripcion}
                    onChange={e=>setRow(i,{descripcion:e.target.value})}
                    maxLength={50}
                    placeholder="Opcional"
                  />
                </label>
              </div>
            )
          })}

          <button type="button" className="btn-secondary" onClick={addRow}>+ Línea</button>

          <div className="muted">Subtotal estimado (si indicaste precios): <b>{fmtMoney(subtotalTotal)}</b></div>

          {msg && <div className="error">{msg}</div>}

          <div className="modal__actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn" disabled={!canSubmit || sending}>
              {sending ? 'Guardando…' : 'Registrar entrega'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
