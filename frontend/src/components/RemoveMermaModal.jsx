import { useEffect, useState } from 'react'
import { removeMerma } from '../api/stock'

export default function RemoveMermaModal({ open, onClose, row, onDone }) {
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return
    setQty('')
    setNote('')
    setMsg('')
    setSending(false)
  }, [open])

  if (!open) return null

  // Deducción del tipo + IDs a partir del row de la tabla de merma
  const infer = () => {
    const type = (row.type || row.TIPO || '').toString().toUpperCase()
    if (type === 'PRIMARY') {
      const itemId = Number(row.primaterId || row.PRIMATER_ID || row.ID_PRIMATER || row.itemId)
      return { type: 'PRIMARY', itemId }
    } else if (type === 'FINISHED') {
      const itemId = Number(row.productId || row.PRODUCT_ID || row.ID_PRODUCT || row.itemId)
      return { type: 'FINISHED', itemId }
    }
    // fallback: si no vino el type, asumimos PRIMARY si hay primaterId, si no FINISHED
    const itemIdPM = Number(row.primaterId || row.ID_PRIMATER)
    if (itemIdPM) return { type: 'PRIMARY', itemId: itemIdPM }
    const itemIdPT = Number(row.productId || row.ID_PRODUCT)
    if (itemIdPT) return { type: 'FINISHED', itemId: itemIdPT }
    return { type: null, itemId: null }
  }

  const { type, itemId } = infer()

  const submit = async (e) => {
    e.preventDefault()
    setMsg('')
    if (!type || !itemId) { setMsg('No se pudo identificar el ítem de merma'); return }
    const qNum = Number(qty)
    if (!(qNum > 0)) { setMsg('Cantidad inválida'); return }

    setSending(true)
    try {
      await removeMerma({ type, itemId, qty: qNum, note: note || undefined })
      onDone?.()
      onClose?.()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error al descartar merma')
    } finally {
      setSending(false)
    }
  }

  const itemName = row.name || row.itemName || row.DESCRIPCION || 'Ítem'
  const typeLabel = type === 'PRIMARY' ? 'Materia Prima' : (type === 'FINISHED' ? 'Producto Terminado' : '—')

  return (
    <div className="modal modal--center">
      <div className="modal__card" style={{ minWidth: 420 }}>
        <div className="modal__header">
          <h4 style={{ margin: 0 }}>Descartar merma</h4>
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>

        <form onSubmit={submit} className="form-col" style={{ gap: 12 }}>
          <div className="muted">
            {typeLabel}: <strong>{itemName}</strong>
          </div>

          <label className="form-field">
            <span>Cantidad a descartar (kg)</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={qty}
              onChange={e => setQty(e.target.value)}
              placeholder="0.00"
              required
            />
          </label>

          <label className="form-field">
            <span>Nota (opcional)</span>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Motivo / referencia" />
          </label>

          {msg && <div className="error">{msg}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <div style={{ flex: 1 }} />
            <button className="btn" disabled={sending}>{sending ? 'Procesando…' : 'Descartar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
