// frontend/src/components/CompositionModal.jsx
import { useEffect, useMemo, useState } from 'react'
import api from '../api/axios'

const ZONAS = ['TRONCO','ALMA','CUBIERTA']

export default function CompositionModal({ open, onClose, productId, onDone }) {
  const [materials, setMaterials] = useState([])
  const [rows, setRows] = useState([{ primaterId:'', zone:'TRONCO', percentage:'' }])
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return
    setMsg('')
    setRows([{ primaterId:'', zone:'TRONCO', percentage:'' }])
    // catálogo MP
    api.get('/api/primary-materials', { params:{ limit: 1000 } })
      .then(r => setMaterials(Array.isArray(r.data) ? r.data : []))
      .catch(()=>setMaterials([]))
  }, [open])

  const total = useMemo(
    () => rows.reduce((a,r)=> a + Number(r.percentage || 0), 0),
    [rows]
  )

  const canSubmit =
    productId &&
    rows.length>0 &&
    rows.every(r => r.primaterId && r.zone && Number(r.percentage)>0) &&
    total <= 100 + 1e-9

  const addRow    = () => setRows(rs => [...rs, { primaterId:'', zone:'TRONCO', percentage:'' }])
  const setRow    = (i, patch) => setRows(rs => rs.map((r,idx)=> idx===i ? { ...r, ...patch } : r))
  const removeRow = (i) => setRows(rs => rs.filter((_,idx)=> idx!==i))

  const submit = async (e) => {
    e.preventDefault()
    setMsg('')
    if (!productId) { setMsg('Selecciona un producto'); return }
    if (!canSubmit) { setMsg('Revisa los porcentajes (total ≤ 100%)'); return }

    setSending(true)
    try {
      // ⚠️ Backend espera { lines: [...] }
      await api.put(`/api/products/${productId}/composition`, {
        lines: rows.map(r => ({
          primaterId: Number(r.primaterId),
          zone: r.zone,
          percentage: Number(r.percentage)
        }))
      })
      onDone?.()
      onClose?.()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error guardando composición')
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
          <h4 className="modal__title">Composición del producto</h4>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <form onSubmit={submit} className="form-col" style={{ gap:12 }}>
          {rows.map((r, i) => (
            <div key={i} className="form-row" style={{ gridTemplateColumns:'2fr 1fr 1fr auto' }}>
              <label className="form-field">
                <span>Materia Prima</span>
                <select value={r.primaterId} onChange={e=>setRow(i,{ primaterId:e.target.value })} required>
                  <option value="">—</option>
                  {materials.map(m => {
                    const id  = m.id || m.ID_PRIMATER
                    const txt =
                      (m.material || m.MATERIAL || '') +
                      (m.color ? ` / ${m.color}` : (m.COLOR ? ` / ${m.COLOR}` : '')) +
                      (m.descripcion || m.DESCRIPCION ? ` · ${m.descripcion || m.DESCRIPCION}` : '')
                    return <option key={id} value={id}>{txt || (m.descripcion || m.DESCRIPCION || `MP #${id}`)}</option>
                  })}
                </select>
              </label>

              <label className="form-field">
                <span>Zona</span>
                <select value={r.zone} onChange={e=>setRow(i,{ zone:e.target.value })}>
                  {ZONAS.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              </label>

              <label className="form-field">
                <span>%</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="100"
                  value={r.percentage}
                  onChange={e=>setRow(i,{ percentage:e.target.value })}
                  required
                />
              </label>

              <div className="form-actions">
                {rows.length>1 && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={()=>removeRow(i)}
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>
          ))}

          <div className="muted">Total: <strong>{total.toFixed(2)}%</strong> (debe ser ≤ 100%)</div>

          {msg && <div className="error">{msg}</div>}

          <div className="modal__actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn" disabled={!canSubmit || sending}>
              {sending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
