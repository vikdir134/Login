// frontend/src/components/AddMermaModal.jsx
import { useEffect, useState } from 'react'
import api from '../api/axios'

export default function AddMermaModal({ open, onClose, onDone }) {
  const [source, setSource] = useState('PRIMARY') // PRIMARY | FINISHED
  const [from, setFrom] = useState('PRODUCCION')  // RECEPCION | PRODUCCION | ALMACEN
  const [itemId, setItemId] = useState('')
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')

  const [mpCatalog, setMpCatalog] = useState([])
  const [ptCatalog, setPtCatalog] = useState([])

  useEffect(() => {
    if (!open) return
    setMsg('')

    api.get('/api/primary-materials?limit=1000')
      .then(r => setMpCatalog(Array.isArray(r.data) ? r.data : []))
      .catch(() => setMpCatalog([]))

    api.get('/api/catalog/products?limit=1000')
      .then(r => setPtCatalog(Array.isArray(r.data) ? r.data : []))
      .catch(() => setPtCatalog([]))
  }, [open])

  const reset = () => {
    setSource('PRIMARY'); setFrom('PRODUCCION'); setItemId(''); setQty(''); setNote(''); setMsg('')
  }

  const submit = async (e) => {
    e.preventDefault()
    setMsg('')
    if (!itemId || !(Number(qty) > 0)) { setMsg('Completa los campos'); return }
    try {
      await api.post('/api/stock/merma/add', {
        source, from, itemId: Number(itemId), qty: Number(qty), note: note || null
      })
      onDone?.()
      reset()
      onClose?.()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error agregando merma')
    }
  }

  if (!open) return null
  return (
    <div className="modal modal--center">
      <div className="modal__overlay" onClick={onClose} />
      <div className="modal__panel">
        <div className="modal__head">
          <h4 className="modal__title">Agregar merma</h4>
          <button className="icon-btn" aria-label="Cerrar" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={submit} className="grid" style={{ gap: 12 }}>
          <label className="form-field">
            <span>Tipo de origen</span>
            <select value={source} onChange={e=>setSource(e.target.value)}>
              <option value="PRIMARY">Materia prima</option>
              <option value="FINISHED">Producto terminado</option>
            </select>
          </label>

          <label className="form-field">
            <span>Zona de origen</span>
            <select value={from} onChange={e=>setFrom(e.target.value)}>
              <option value="RECEPCION">Recepción (MP)</option>
              <option value="PRODUCCION">Producción (MP)</option>
              <option value="ALMACEN">Almacén (PT)</option>
            </select>
          </label>

          {source === 'PRIMARY' ? (
            <label className="form-field">
              <span>Materia prima</span>
              <select value={itemId} onChange={e=>setItemId(e.target.value)} required>
                <option value="">— Selecciona —</option>
                {mpCatalog.map(m => (
                  <option key={m.id || m.ID_PRIMATER} value={m.id || m.ID_PRIMATER}>
                    {m.descripcion || m.DESCRIPCION}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="form-field">
              <span>Producto terminado</span>
              <select value={itemId} onChange={e=>setItemId(e.target.value)} required>
                <option value="">— Selecciona —</option>
                {ptCatalog.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name || p.DESCRIPCION}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="form-field">
            <span>Peso (kg)</span>
            <input type="number" step="0.01" min="0.01" value={qty} onChange={e=>setQty(e.target.value)} required />
          </label>

          <label className="form-field">
            <span>Nota</span>
            <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Opcional" />
          </label>

          {msg && <div className="error">{msg}</div>}

          <div className="modal__actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  )
}
