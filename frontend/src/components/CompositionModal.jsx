// frontend/src/components/CompositionModal.jsx
import { useEffect, useMemo, useState } from 'react'
import api from '../api/axios'

const ZONAS = ['TRONCO', 'ALMA', 'CUBIERTA']

/**
 * Props:
 * - open: bool
 * - onClose: fn
 * - productId: number | null (si viene, se fija y no se muestra el selector de productos)
 * - onDone: fn (se llama al guardar OK)
 */
export default function CompositionModal({ open, onClose, productId, onDone }) {
  // estado UI
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')

  // datos catálogo
  const [materials, setMaterials] = useState([]) // MP
  const [products, setProducts]   = useState([]) // productos sin composición

  // selección de producto (cuando no viene por props)
  const [selectedProductId, setSelectedProductId] = useState(productId || '')

  // filas de composición
  const [rows, setRows] = useState([
    { primaterId: '', zone: 'TRONCO', percentage: '' }
  ])

  // -------- helpers --------
  const theProductId = productId || Number(selectedProductId) || null

  const totalPercent = useMemo(
    () => rows.reduce((a, r) => a + Number(r.percentage || 0), 0),
    [rows]
  )

  const canSubmit = useMemo(() => {
    if (!theProductId) return false
    if (!Array.isArray(rows) || rows.length === 0) return false
    for (const r of rows) {
      if (!r.primaterId) return false
      if (!ZONAS.includes(String(r.zone))) return false
      if (!(Number(r.percentage) > 0)) return false
    }
    // <= 100% (si quieres EXACTO 100, cambia por: return totalPercent > 0 && Math.abs(totalPercent - 100) < 1e-9)
    return totalPercent <= 100 + 1e-9
  }, [rows, theProductId, totalPercent])

  // -------- efectos --------
  useEffect(() => {
    if (!open) return
    setMsg('')

    // limpiar filas cuando se abre
    setRows([{ primaterId: '', zone: 'TRONCO', percentage: '' }])

    // si el modal no recibió productId, cargar productos sin composición
    if (!productId) {
      api.get('/api/products/without-composition', { params: { limit: 1000 } })
        .then(r => setProducts(Array.isArray(r.data) ? r.data : []))
        .catch(() => setProducts([]))
      setSelectedProductId('')
    } else {
      setSelectedProductId(productId)
    }

    // catálogo de MP
    api.get('/api/primary-materials', { params: { limit: 2000 } })
      .then(r => setMaterials(Array.isArray(r.data) ? r.data : []))
      .catch(() => setMaterials([]))
  }, [open, productId])

  // -------- handlers --------
  const addRow = () => {
    setRows(rs => [...rs, { primaterId: '', zone: 'TRONCO', percentage: '' }])
  }
  const setRow = (idx, patch) => {
    setRows(rs => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }
  const removeRow = (idx) => {
    setRows(rs => rs.filter((_, i) => i !== idx))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit || !theProductId) return
    setSending(true); setMsg('')

    try {
      const payload = {
        items: rows.map(r => ({
          primaterId: Number(r.primaterId),
          zone: r.zone,
          percentage: Number(r.percentage)
        }))
      }
      await api.put(`/api/products/${theProductId}/composition`, payload)
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
    <div
      className="modal"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 9999
      }}
    >
      <div
        className="modal__card"
        style={{
          width: 'min(860px, 96vw)',
          background: 'var(--panel, #fff)',
          borderRadius: 12,
          padding: 16,
          boxShadow: '0 10px 30px rgba(0,0,0,0.25)'
        }}
      >
        <div
          className="modal__header"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}
        >
          <h4 style={{ margin: 0 }}>Componer producto</h4>
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>

        <form onSubmit={submit} className="form-col" style={{ display: 'grid', gap: 12 }}>
          {/* Selector de producto (solo si no viene por props) */}
          {!productId && (
            <label className="form-field" style={{ display: 'grid', gap: 4 }}>
              <span>Producto (sin composición)</span>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                required
              >
                <option value="">— Selecciona —</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name || p.DESCRIPCION || `Producto #${p.id}`}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="muted">Filas de composición</div>

          {rows.map((r, i) => {
            const denierTxt = (m) => {
              const d = m.denier || m.DENIER
              return (d != null && d !== '') ? ` · ${d}` : ''
            }
            return (
              <div
                key={i}
                className="form-row"
                style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}
              >
                <label className="form-field" style={{ display: 'grid', gap: 4 }}>
                  <span>Materia prima</span>
                  <select
                    value={r.primaterId}
                    onChange={(e) => setRow(i, { primaterId: e.target.value })}
                    required
                  >
                    <option value="">—</option>
                    {materials.map(m => {
                      const id  = m.id || m.ID_PRIMATER
                      const mat = m.material || m.MATERIAL || ''
                      const col = m.color || m.COLOR || ''
                      const des = m.descripcion || m.DESCRIPCION || ''
                      return (
                        <option key={id} value={id}>
                          {`${mat}${col ? ' / ' + col : ''}${des ? ' · ' + des : ''}${denierTxt(m)}`}
                        </option>
                      )
                    })}
                  </select>
                </label>

                <label className="form-field" style={{ display: 'grid', gap: 4 }}>
                  <span>Zona</span>
                  <select
                    value={r.zone}
                    onChange={(e) => setRow(i, { zone: e.target.value })}
                    required
                  >
                    {ZONAS.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                </label>

                <label className="form-field" style={{ display: 'grid', gap: 4 }}>
                  <span>%</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="100"
                    value={r.percentage}
                    onChange={(e) => setRow(i, { percentage: e.target.value })}
                    required
                  />
                </label>

                <div className="form-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => removeRow(i)}
                      title="Quitar fila"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          <div className="muted">
            Total: <strong>{totalPercent.toFixed(2)}%</strong> (debe ser ≤ 100%)
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" className="btn-secondary" onClick={addRow}>+ Agregar MP</button>
            <div style={{ flex: 1 }} />
            <button className="btn" disabled={!canSubmit || sending}>
              {sending ? 'Guardando…' : 'Guardar composición'}
            </button>
          </div>

          {msg && <div className="error">{msg}</div>}
        </form>
      </div>
    </div>
  )
}
