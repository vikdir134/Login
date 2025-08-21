import { useEffect, useMemo, useState } from 'react'
import { listProducts, getProductComposition, listPresentationsByProduct } from '../api/almacen'
import { createFinishedInput } from '../api/almacen'

export default function AddFinishedModal({ open, onClose, onSaved }) {
  const [products, setProducts] = useState([])
  const [presentations, setPresentations] = useState([])
  const [productId, setProductId] = useState('')
  const [peso, setPeso] = useState('')
  const [presentationId, setPresentationId] = useState('')
  const [composition, setComposition] = useState([]) // [{ primaterId, zone, percentage }]
  const [manual, setManual] = useState(false)
  const [manualRows, setManualRows] = useState([{ primaterId: '', qty: '' }])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!open) return
    // catálogo de productos
    listProducts({ limit: 1000 })
      .then(setProducts)
      .catch(() => setProducts([]))
  }, [open])

  // carga composición + presentaciones al elegir producto
  useEffect(() => {
    if (!productId) { setComposition([]); setPresentations([]); setPresentationId(''); return }
    getProductComposition(productId)
      .then((rows) => { setComposition(Array.isArray(rows) ? rows : []) })
      .catch(() => setComposition([]))
    listPresentationsByProduct(productId)
      .then((rows) => setPresentations(Array.isArray(rows) ? rows : []))
      .catch(() => setPresentations([]))
  }, [productId])

  const consumoAuto = useMemo(() => {
    const total = Number(peso || 0)
    if (!total || !composition?.length) return []
    // Solo componentes marcados en zona (TRONCO/ALMA/CUBIERTA); el consumo descuenta de zona PRODUCCION en backend
    return composition.map(c => ({
      primaterId: c.ID_PRIMATER || c.primaterId,
      percentage: Number(c.PERCENTAGE || c.percentage || 0),
      qty: +(total * (Number(c.PERCENTAGE || c.percentage || 0) / 100)).toFixed(2),
      zone: c.ZONE || c.zone
    }))
  }, [peso, composition])

  const canSubmit = useMemo(() => {
    if (!productId) return false
    if (!(Number(peso) > 0)) return false
    if (!presentationId) return false
    if (manual) {
      if (!manualRows.length) return false
      for (const r of manualRows) {
        if (!r.primaterId || !(Number(r.qty) > 0)) return false
      }
    }
    return true
  }, [productId, peso, presentationId, manual, manualRows])

  const addManualRow = () => setManualRows(rs => [...rs, { primaterId: '', qty: '' }])
  const setManualRow = (idx, patch) =>
    setManualRows(rs => rs.map((r, i) => i === idx ? { ...r, ...patch } : r))
  const removeManualRow = (idx) =>
    setManualRows(rs => rs.filter((_, i) => i !== idx))

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true); setMsg('')
    try {
      const payload = {
        productId: Number(productId),
        peso: Number(peso),
        presentationId: Number(presentationId),
        // El backend debe forzar espacio de destino = ALMACEN (PT)
        // y consumir MP desde zona PRODUCCION
        consumeMode: (!composition.length || manual) ? 'MANUAL' : 'AUTO',
        manualConsumptions: manual ? manualRows.map(r => ({
          primaterId: Number(r.primaterId), qty: Number(r.qty)
        })) : undefined,
      }
      await createFinishedInput(payload)
      onSaved?.()
    } catch (e2) {
      console.error(e2)
      setMsg(e2.response?.data?.error || 'Error agregando PT (verifica stock en PRODUCCION)')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null
  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h4 style={{ margin:0 }}>Agregar producto terminado</h4>
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>

        <form onSubmit={submit} style={{ display:'grid', gap:12, marginTop:12 }}>
          <label className="form-field">
            <span>Producto</span>
            <select value={productId} onChange={e => setProductId(e.target.value)} required>
              <option value="">—</option>
              {products.map(p => (
                <option key={p.id || p.ID_PRODUCT} value={p.id || p.ID_PRODUCT}>
                  {p.name || p.DESCRIPCION || `Producto #${p.id || p.ID_PRODUCT}`}
                </option>
              ))}
            </select>
          </label>

          <div className="form-row" style={{ gridTemplateColumns:'1fr 1fr' }}>
            <label className="form-field">
              <span>Peso total (kg)</span>
              <input type="number" step="0.01" min="0.01" value={peso} onChange={e => setPeso(e.target.value)} />
            </label>

            <label className="form-field">
              <span>Presentación</span>
              <select value={presentationId} onChange={e => setPresentationId(e.target.value)} required>
                <option value="">—</option>
                {presentations.map(pp => (
                  <option key={pp.id || pp.ID_PRESENTATION} value={pp.id || pp.ID_PRESENTATION}>
                    {(pp.PESO_KG || pp.PRESENTATION_KG || pp.pesoKg)?.toFixed
                      ? (pp.PESO_KG || pp.PRESENTATION_KG || pp.pesoKg).toFixed(2)
                      : Number(pp.PESO_KG || pp.PRESENTATION_KG || pp.pesoKg || 0).toFixed(2)} kg
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Bloque de composición */}
          {!!composition.length && !manual && (
            <div className="card" style={{ background:'transparent', border:'1px dashed var(--border)' }}>
              <div className="muted" style={{ marginBottom:6 }}>Consumo automático según composición (desde zona Producción):</div>
              <div className="table">
                <div className="table__head" style={{ gridTemplateColumns:'2fr 1fr 1fr' }}>
                  <div>Materia prima</div>
                  <div>%</div>
                  <div>Consumo (kg)</div>
                </div>
                {consumoAuto.map((c, i) => (
                  <div className="table__row" key={i} style={{ gridTemplateColumns:'2fr 1fr 1fr' }}>
                    <div>MP #{c.primaterId} ({c.zone})</div>
                    <div>{c.percentage.toFixed(2)}%</div>
                    <div>{c.qty.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Toggle manual si no hay composición o si el usuario decide */}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input
              id="manual"
              type="checkbox"
              checked={manual || !composition.length}
              onChange={() => setManual(m => !m)}
              disabled={!composition.length} // si no hay comp, manual queda activo/obligatorio
            />
            <label htmlFor="manual">{composition.length ? 'Usar consumo manual (ignorar composición)' : 'No hay composición: ingreso manual obligatorio'}</label>
          </div>

          {(manual || !composition.length) && (
            <div>
              <div className="muted" style={{ marginBottom:6 }}>
                Consumo manual desde zona Producción (no debe exceder el peso del PT).
              </div>
              {manualRows.map((r, idx) => {
                return (
                  <div key={idx} className="form-row" style={{ gridTemplateColumns:'2fr 1fr auto' }}>
                    <label className="form-field">
                      <span>Materia prima</span>
                      <input
                        placeholder="ID_PRIMATER (ej. 5)"
                        value={r.primaterId}
                        onChange={e => setManualRow(idx, { primaterId: e.target.value })}
                      />
                    </label>
                    <label className="form-field">
                      <span>Cantidad (kg)</span>
                      <input
                        type="number" step="0.01" min="0.01"
                        value={r.qty}
                        onChange={e => setManualRow(idx, { qty: e.target.value })}
                      />
                    </label>
                    <div className="form-actions">
                      {manualRows.length > 1 && (
                        <button type="button" className="btn-secondary" onClick={() => removeManualRow(idx)}>Quitar</button>
                      )}
                    </div>
                  </div>
                )
              })}
              <div>
                <button type="button" className="btn-secondary" onClick={addManualRow}>+ MP</button>
              </div>
            </div>
          )}

          <div style={{ display:'flex', gap:8 }}>
            <div style={{ flex:1 }} />
            <button className="btn" disabled={!canSubmit || saving}>
              {saving ? 'Guardando…' : 'Registrar PT'}
            </button>
          </div>

          {msg && <div className="error">{msg}</div>}
        </form>
      </div>
    </div>
  )
}
