// frontend/src/components/AddMermaModal.jsx
import { useEffect, useMemo, useState } from 'react'
import { addMerma } from '../api/stock'

export default function AddMermaModal({ open, onClose, onDone }) {
  const [sourceType, setSourceType] = useState('PRIMARY')       // PRIMARY | FINISHED
  const [sourceZone, setSourceZone] = useState('RECEPCION')     // para PRIMARY: RECEPCION/PRODUCCION; para FINISHED: ALMACEN
  const [itemId, setItemId] = useState('')
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!open) return
    setSourceType('PRIMARY')
    setSourceZone('RECEPCION')
    setItemId('')
    setQty('')
    setNote('')
    setMsg('')
  }, [open])

  // si es FINISHED, la zona es ALMACEN
  useEffect(() => {
    if (sourceType === 'FINISHED') setSourceZone('ALMACEN')
  }, [sourceType])

  const canSubmit = useMemo(() => {
    const okZone = sourceType === 'PRIMARY'
      ? ['RECEPCION', 'PRODUCCION'].includes(sourceZone)
      : sourceZone === 'ALMACEN'
    return okZone && Number(itemId) > 0 && Number(qty) > 0
  }, [sourceType, sourceZone, itemId, qty])

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSending(true); setMsg('')
    try {
      await addMerma({
        sourceType, sourceZone,
        itemId: Number(itemId),
        qty: Number(qty),
        note: note || null
      })
      setMsg('✅ Merma registrada')
      onDone?.()
      onClose?.()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error registrando merma')
    } finally {
      setSending(false)
    }
  }

  if (!open) return null
  return (
    <div className="modal">
      <div className="modal__card">
        <div className="modal__header">
          <h4 style={{ margin:0 }}>Agregar Merma</h4>
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>

        <form onSubmit={submit} className="form-col" style={{ gap:12 }}>
          <div className="form-row">
            <label className="form-field">
              <span>Tipo origen</span>
              <select value={sourceType} onChange={e=>setSourceType(e.target.value)}>
                <option value="PRIMARY">Materia Prima</option>
                <option value="FINISHED">Producto Terminado</option>
              </select>
            </label>

            <label className="form-field">
              <span>Zona origen</span>
              <select
                value={sourceZone}
                onChange={e=>setSourceZone(e.target.value)}
                disabled={sourceType === 'FINISHED'} // PT solo desde ALMACEN
              >
                {sourceType === 'PRIMARY' ? (
                  <>
                    <option value="RECEPCION">RECEPCION</option>
                    <option value="PRODUCCION">PRODUCCION</option>
                  </>
                ) : (
                  <option value="ALMACEN">ALMACEN</option>
                )}
              </select>
            </label>
          </div>

          <div className="form-row">
            <label className="form-field">
              <span>{sourceType === 'PRIMARY' ? 'ID Materia Prima' : 'ID Producto'}</span>
              <input value={itemId} onChange={e=>setItemId(e.target.value)} placeholder={sourceType === 'PRIMARY' ? 'ID_PRIMATER' : 'ID_PRODUCT'} required />
            </label>
            <label className="form-field">
              <span>Cantidad a mermar (kg)</span>
              <input type="number" step="0.01" min="0.01" value={qty} onChange={e=>setQty(e.target.value)} required />
            </label>
          </div>

          <label className="form-field">
            <span>Nota (opcional)</span>
            <input value={note} onChange={e=>setNote(e.target.value)} />
          </label>

          {msg && <div className="muted">{msg}</div>}
          <div className="form-actions" style={{ justifyContent:'flex-end' }}>
            <button className="btn" disabled={!canSubmit || sending}>{sending ? 'Guardando…' : 'Registrar merma'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
