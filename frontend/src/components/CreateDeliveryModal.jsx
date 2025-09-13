// src/components/CreateDeliveryModal.jsx
import { useEffect, useMemo, useState } from 'react'
import { getEffectivePrice } from '../api/prices'
import { createDelivery } from '../api/deliveries'
import { uploadInvoice, uploadGuia } from '../api/docs'

const fmtKg = n => (Number(n) || 0).toFixed(2)
const fmtMoney = n => (Number(n) || 0).toFixed(2)

export default function CreateDeliveryModal({ open, onClose, order, onDone }) {
  const [rows, setRows] = useState([
    { descriptionOrderId: '', peso: '', unitPrice: '', currency: 'PEN', descripcion: '' }
  ])
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')

  // ===== Archivos PDF (opcionales) =====
  const [pdfFactura, setPdfFactura] = useState(null)
  const [pdfGuia, setPdfGuia] = useState(null)

  // Hover/Focus para ✕
  const [closeHover, setCloseHover] = useState(false)

  // Mapa de líneas para validar pendiente / sugerir precio
  const lineMap = useMemo(() => {
    const m = new Map()
    for (const l of order?.lines || []) m.set(String(l.id), l)
    return m
  }, [order])

  useEffect(() => {
    if (!open) return
    setRows([{ descriptionOrderId: '', peso: '', unitPrice: '', currency: 'PEN', descripcion: '' }])
    setMsg('')
    setSending(false)
    setPdfFactura(null)
    setPdfGuia(null)
  }, [open])

  const setRow = (i, patch) =>
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const addRow = () =>
    setRows(rs => [...rs, { descriptionOrderId: '', peso: '', unitPrice: '', currency: 'PEN', descripcion: '' }])

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
      if (r.unitPrice !== '' && r.unitPrice != null && isNaN(Number(r.unitPrice))) return false
    }
    // PDFs son opcionales
    return true
  }, [rows, lineMap])

  const subtotalTotal = rows.reduce(
    (a, r) => a + (Number(r.peso) || 0) * (Number(r.unitPrice || 0) || 0),
    0
  )

  const onPickLine = async (i, descriptionOrderId) => {
    setRow(i, { descriptionOrderId })
    const line = lineMap.get(String(descriptionOrderId))
    if (!line) return
    if (rows[i].unitPrice === '' || rows[i].unitPrice == null) {
      const eff = await getEffectivePrice({ customerId: order.customerId, productId: line.productId }).catch(() => null)
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
      // 1) Subir factura/guía si fueron adjuntas (el backend toma el CÓDIGO del nombre del archivo)
      let facturaId = null
      let guiaId = null

      if (pdfFactura) {
        const inv = await uploadInvoice(pdfFactura).catch((err) => {
          throw new Error(err?.response?.data?.error || 'No se pudo subir la factura PDF')
        })
        facturaId = inv?.id || null
      }
      if (pdfGuia) {
        const gv = await uploadGuia(pdfGuia).catch((err) => {
          throw new Error(err?.response?.data?.error || 'No se pudo subir la guía PDF')
        })
        guiaId = gv?.id || null
      }

      // 2) Normalizar líneas
      const lines = rows.map(r => ({
        descriptionOrderId: Number(r.descriptionOrderId),
        peso: Number(r.peso),
        descripcion: r.descripcion || null,
        unitPrice: (r.unitPrice === '' || r.unitPrice == null) ? undefined : Number(r.unitPrice),
        currency: r.currency || 'PEN'
      }))

      // 3) Crear entrega (maneja confirmación si no hay ni factura ni guía)
      const tryCreate = async (allowNoDocs = false) => {
        return createDelivery(order.id, { facturaId, guiaId, lines, ...(allowNoDocs ? { allowNoDocs: true } : {}) })
      }

      try {
        await tryCreate(false)
      } catch (err) {
        const status = err?.response?.status
        const code = err?.response?.data?.code
        if (status === 409 && code === 'CONFIRM_NODOCS_REQUIRED') {
          const ok = window.confirm('Estás registrando una entrega sin factura ni guía. ¿Deseas continuar?')
          if (!ok) throw err
          await tryCreate(true)
        } else {
          throw err
        }
      }

      onDone?.()
    } catch (err) {
      console.error('CreateDelivery error:', err?.response?.data || err)
      setMsg(err?.response?.data?.error || err?.message || 'Error creando entrega')
    } finally {
      setSending(false)
    }
  }

  if (!open) return null
  return (
    <div className="modal modal--center">
      <div className="modal__overlay" onClick={onClose} />
      <div className="modal__panel" style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--card)' }}>
        <div className="modal__head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <h4 className="modal__title" style={{ margin: 0 }}>Nueva entrega (múltiples líneas)</h4>
          <button
            className="icon-btn icon-btn--close"
            onClick={onClose}
            onMouseEnter={() => setCloseHover(true)}
            onMouseLeave={() => setCloseHover(false)}
            title="Cerrar"
            style={{
              width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center',
              border: '1px solid var(--card)', background: 'transparent',
              cursor: 'pointer', transition: 'all .15s ease',
              color: closeHover ? '#b91c1c' : 'var(--text)'
            }}
          >✕</button>
        </div>

        <form onSubmit={submit} className="form-col" style={{ gap: 12 }}>
          {/* ====== ARCHIVOS PDF OPCIONALES ====== */}
          <div className="card" style={{ background: 'transparent', border: '1px dashed var(--border)', padding: 12 }}>
            <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label className="form-field">
                <span>Factura (PDF)</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={e => setPdfFactura(e.target.files?.[0] || null)}
                />
                {pdfFactura && (
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Se tomará el código desde el nombre: <b>{pdfFactura.name}</b>
                  </div>
                )}
              </label>

              <label className="form-field">
                <span>Guía (PDF)</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={e => setPdfGuia(e.target.files?.[0] || null)}
                />
                {pdfGuia && (
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Se tomará el código desde el nombre: <b>{pdfGuia.name}</b>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* ====== LÍNEAS ====== */}
          <div className="muted">Líneas de la entrega</div>
          {rows.map((r, i) => {
            const line = lineMap.get(String(r.descriptionOrderId))
            const borderWarn = line && Number(r.peso) > Number(line.pendiente) ? '1px solid #b91c1c' : '1px solid var(--card)'
            return (
              <div key={i} className="form-row" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr auto', border: borderWarn, borderRadius: 12, padding: 10 }}>
                <label className="form-field">
                  <span>Línea (producto · presentación)</span>
                  <select
                    value={r.descriptionOrderId}
                    onChange={(e) => onPickLine(i, e.target.value)}
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
                    onChange={e => setRow(i, { peso: e.target.value })}
                    required
                  />
                  {line && Number(r.peso) > Number(line.pendiente) && (
                    <div className="muted" style={{ color: '#b91c1c' }}>
                      Máx {fmtKg(line.pendiente)} kg
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
                    onChange={e => setRow(i, { unitPrice: e.target.value })}
                    placeholder="vacío = precio vigente"
                  />
                </label>

                <label className="form-field">
                  <span>Moneda</span>
                  <select
                    value={r.currency}
                    onChange={e => setRow(i, { currency: e.target.value })}
                  >
                    <option value="PEN">PEN</option>
                    <option value="USD">USD</option>
                  </select>
                </label>

                <div className="form-actions" style={{ alignSelf: 'end' }}>
                  {rows.length > 1 && (
                    <button type="button" className="btn-secondary" onClick={() => removeRow(i)}>Quitar</button>
                  )}
                </div>

                <label className="form-field" style={{ gridColumn: '1 / -1' }}>
                  <span>Comentario</span>
                  <input
                    value={r.descripcion}
                    onChange={e => setRow(i, { descripcion: e.target.value })}
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
