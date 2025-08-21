// frontend/src/components/AddPTModal.jsx
import { useEffect, useMemo, useState } from 'react'
import { fetchProductsLite, fetchPresentations, createFinishedInput, fetchPrimaryMaterialsLite } from '../api/stock'

export default function AddPTModal({ open, onClose, defaultZoneId, onDone }) {
  const [products, setProducts] = useState([])
  const [presentations, setPresentations] = useState([])
  const [materials, setMaterials] = useState([])

  const [productId, setProductId] = useState('')
  const [peso, setPeso] = useState('')
  const [presentationId, setPresentationId] = useState('')
  const [presentationKg, setPresentationKg] = useState('')
  const [useComposition, setUseComposition] = useState(true)
  const [consumos, setConsumos] = useState([{ primaterId: '', peso: '' }])

  const [loadingPres, setLoadingPres] = useState(false)
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!open) return
    setMsg('')
    fetchProductsLite().then(setProducts).catch(()=>setProducts([]))
    fetchPrimaryMaterialsLite(1000).then(setMaterials).catch(()=>setMaterials([]))
  }, [open])

  useEffect(() => {
    setPresentations([]); setPresentationId(''); setPresentationKg('')
    if (!productId) return
    setLoadingPres(true)
    fetchPresentations(productId)
      .then(setPresentations)
      .catch(()=>setPresentations([]))
      .finally(()=>setLoadingPres(false))
  }, [productId])

  const canSubmit = useMemo(() => {
    if (!productId || !defaultZoneId || !(+peso > 0)) return false
    if (!useComposition) {
      if (!Array.isArray(consumos) || consumos.length === 0) return false
      const sum = consumos.reduce((a, b) => a + Number(b.peso || 0), 0)
      if (!(sum > 0) || sum - Number(peso) > 1e-9) return false
      if (consumos.some(c => !c.primaterId || Number(c.peso) <= 0)) return false
    }
    return true
  }, [productId, defaultZoneId, peso, useComposition, consumos])

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSending(true); setMsg('')
    try {
      const payload = {
        productId: Number(productId),
        zoneId: Number(defaultZoneId),
        peso: Number(peso),
        useComposition
      }
      if (presentationId) payload.presentationId = Number(presentationId)
      else if (presentationKg) payload.presentationKg = Number(presentationKg)

      if (!useComposition) {
        payload.consumos = consumos.map(c => ({ primaterId: Number(c.primaterId), peso: Number(c.peso) }))
      }

      await createFinishedInput(payload)
      onDone?.(); onClose?.()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error al ingresar PT')
    } finally { setSending(false) }
  }

  const addConsumo = () => setConsumos(cs => [...cs, { primaterId: '', peso: '' }])
  const setConsumo = (i, patch) => setConsumos(cs => cs.map((c, idx) => idx === i ? { ...c, ...patch } : c))
  const removeConsumo = (i) => setConsumos(cs => cs.filter((_, idx) => idx !== i))

  if (!open) return null
  return (
    <div className="modal modal--center">
      <div className="modal__card">
        <div className="modal__header">
          <h4 style={{ margin:0 }}>Ingresar Producto Terminado</h4>
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>

        <form onSubmit={onSubmit} className="form-col" style={{ gap:12 }}>
          <label className="form-field">
            <span>Producto</span>
            <select value={productId} onChange={e => setProductId(e.target.value)} required>
              <option value="">—</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name || p.DESCRIPCION}</option>)}
            </select>
          </label>

          <div className="form-row">
            <label className="form-field">
              <span>Peso total (kg)</span>
              <input type="number" step="0.01" min="0.01" value={peso} onChange={e=>setPeso(e.target.value)} required />
            </label>
            <label className="form-field">
              <span>Presentación (catálogo)</span>
              <select
                value={presentationId}
                onChange={e => { setPresentationId(e.target.value); setPresentationKg('') }}
                disabled={loadingPres || !productId}
              >
                <option value="">—</option>
                {presentations.map(pr => (
                  <option key={pr.id} value={pr.id}>{Number(pr.presentationKg).toFixed(2)} kg</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Presentación (kg) manual</span>
              <input
                type="number" step="0.01" min="0"
                value={presentationKg}
                onChange={e => { setPresentationKg(e.target.value); setPresentationId('') }}
                placeholder="opcional"
              />
            </label>
          </div>

          <label className="form-switch">
            <input type="checkbox" checked={useComposition} onChange={e=>setUseComposition(e.target.checked)} />
            <span>Usar composición del producto (si existe)</span>
          </label>

          {!useComposition && (
            <>
              <div className="muted">Consumos de MP (manual)</div>
              {consumos.map((c, i) => (
                <div key={i} className="form-row" style={{ gridTemplateColumns:'2fr 1fr auto' }}>
                  <label className="form-field">
                    <span>Materia Prima</span>
                    <select value={c.primaterId} onChange={e => setConsumo(i, { primaterId: e.target.value })} required>
                      <option value="">—</option>
                      {materials.map(m => {
                        const id = m.id || m.ID_PRIMATER
                        const desc = m.descripcion || m.DESCRIPCION || ''
                        const mat = m.material || m.MATERIAL || ''
                        const col = m.color || m.COLOR || ''
                        return <option key={id} value={id}>{`${mat}${col ? ' / '+col : ''}${desc ? ' · '+desc : ''}`}</option>
                      })}
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Peso (kg)</span>
                    <input type="number" step="0.01" min="0.01" value={c.peso} onChange={e => setConsumo(i, { peso: e.target.value })} required />
                  </label>
                  <div className="form-actions">
                    {consumos.length > 1 && <button type="button" className="btn-secondary" onClick={()=>removeConsumo(i)}>Quitar</button>}
                  </div>
                </div>
              ))}
              <button type="button" className="btn-secondary" onClick={addConsumo}>+ Consumo</button>
            </>
          )}

          {msg && <div className="error">{msg}</div>}
          <div className="form-actions" style={{ justifyContent:'flex-end' }}>
            <button className="btn" disabled={sending || !canSubmit}>{sending ? 'Guardando…' : 'Ingresar PT'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
