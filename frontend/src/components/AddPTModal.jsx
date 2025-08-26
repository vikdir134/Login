// frontend/src/components/AddPTModal.jsx
import { useEffect, useMemo, useState } from 'react'
import {
  fetchProductsLite,
  fetchPrimaryMaterialsLite,
  createFinishedInput
} from '../api/stock'
import { getProductComposition } from '../api/almacen' // tu helper existente

const fmt = (n) => (Number(n)||0).toFixed(2)

export default function AddPTModal({ open, onClose, defaultZoneId, onDone }) {
  const [products, setProducts] = useState([])
  const [materials, setMaterials] = useState([])

  const [productId, setProductId] = useState('')
  const [peso, setPeso] = useState('')
  const [presentationKg, setPresentationKg] = useState('')
  const [composition, setComposition] = useState([]) // [{primaterId, zone, percentage}]
  const [useComposition, setUseComposition] = useState(true)

  const [consumos, setConsumos] = useState([{ primaterId: '', peso: '' }])
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!open) return
    setMsg('')
    fetchProductsLite().then(setProducts).catch(()=>setProducts([]))
    fetchPrimaryMaterialsLite(1000).then(setMaterials).catch(()=>setMaterials([]))

    // limpiar al abrir
    setProductId('')
    setPeso('')
    setPresentationKg('')
    setComposition([])
    setUseComposition(true)
    setConsumos([{ primaterId:'', peso:'' }])
  }, [open])

  // cargar composición al elegir producto (si falla → [])
  useEffect(() => {
  if (!productId) {
    setComposition([])
    setUseComposition(false)     // ← forza manual si no hay producto
    return
  }
  getProductComposition(productId)
    .then(rows => {
      const list = Array.isArray(rows) ? rows : []
      setComposition(list)
      setUseComposition(list.length > 0)  // ← si no hay comp, desmarca el check
    })
    .catch(() => {
      setComposition([])
      setUseComposition(false)   // ← en error también manual
    })
}, [productId])

  const autoConsumptions = useMemo(() => {
    const total = Number(peso || 0)
    if (!total || !composition.length) return []
    return composition.map(c => ({
      primaterId: Number(c.primaterId || c.ID_PRIMATER),
      zone: String(c.zone || c.ZONE || 'PRODUCCION'),
      percentage: Number(c.percentage || c.PERCENTAGE || 0),
      qty: +(total * (Number(c.percentage || c.PERCENTAGE || 0) / 100)).toFixed(2)
    }))
  }, [peso, composition])

  const manualSum = useMemo(
    () => consumos.reduce((a, c) => a + Number(c.peso || 0), 0),
    [consumos]
  )

  const canSubmit = useMemo(() => {
    if (!productId || !defaultZoneId || !(+peso > 0)) return false
    if (!useComposition) {
      if (!consumos.length) return false
      if (consumos.some(c => !c.primaterId || !(Number(c.peso) > 0))) return false
      // suma manual no debe exceder peso total
      if (manualSum - Number(peso) > 1e-9) return false
    }
    return true
  }, [productId, defaultZoneId, peso, useComposition, consumos, manualSum])

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSending(true); setMsg('')
    try {
      const payload = {
        productId: Number(productId),
        peso: Number(peso),
        useComposition: !!useComposition
      }
      if (presentationKg && Number(presentationKg) > 0) {
        payload.presentationKg = Number(presentationKg)
      }
      if (!useComposition) {
        payload.consumos = consumos.map(c => ({
          primaterId: Number(c.primaterId),
          peso: Number(c.peso)
        }))
      }
      await createFinishedInput(payload)
      onDone?.()
      onClose?.()
    } catch (err) {
      setMsg(err?.response?.data?.error || 'Error al ingresar PT')
    } finally {
      setSending(false)
    }
  }

  const addConsumo = () => setConsumos(cs => [...cs, { primaterId: '', peso: '' }])
  const setConsumo  = (i, patch) => setConsumos(cs => cs.map((c, idx) => idx === i ? { ...c, ...patch } : c))
  const removeConsumo = (i) => setConsumos(cs => cs.filter((_, idx) => idx !== i))

  if (!open) return null
  return (
    <div className="modal modal--center">
      <div className="modal__card" style={{ minWidth: 720 }}>
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
              <span>Presentación (kg) manual</span>
              <input
                type="number" step="0.01" min="0"
                value={presentationKg}
                onChange={e => setPresentationKg(e.target.value)}
                placeholder="opcional"
              />
              <div className="muted">Se guardará como texto “{presentationKg ? fmt(presentationKg) : 'X.XX'} kg”.</div>
            </label>
          </div>

          <label className="form-switch">
            <input
              type="checkbox"
              checked={useComposition}
              onChange={e => setUseComposition(e.target.checked)}
              disabled={!composition.length}   // ← sin comp, no se puede activar
            />
            <span>Usar composición del producto (si existe)</span>
          </label>

          {useComposition && composition.length > 0 && (
            <div className="card" style={{ background:'transparent', border:'1px dashed var(--border)' }}>
              <div className="muted" style={{ marginBottom:6 }}>Consumo automático (desde zona indicada, por defecto Producción):</div>
              <div className="table">
                <div className="table__head" style={{ gridTemplateColumns:'2fr 1fr 1fr' }}>
                  <div>Materia prima</div>
                  <div>%</div>
                  <div>Consumo (kg)</div>
                </div>
                {autoConsumptions.map((c, i) => (
                  <div key={i} className="table__row" style={{ gridTemplateColumns:'2fr 1fr 1fr' }}>
                    <div>MP #{c.primaterId} ({c.zone})</div>
                    <div>{fmt(c.percentage)}%</div>
                    <div>{fmt(c.qty)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!useComposition && (
            <>
              <div className="muted">Consumos de MP (manual). Suma actual: <b>{fmt(manualSum)} / {fmt(peso)} kg</b></div>
              {consumos.map((c, i) => (
                <div key={i} className="form-row" style={{ gridTemplateColumns:'2fr 1fr auto' }}>
                  <label className="form-field">
                    <span>Materia Prima</span>
                    <select value={c.primaterId} onChange={e => setConsumo(i, { primaterId: e.target.value })} required>
                      <option value="">—</option>
                      {materials.map(m => {
                        const id  = m.id || m.ID_PRIMATER
                        const mat = m.material || m.MATERIAL || ''
                        const col = m.color || m.COLOR || ''
                        const ds  = m.descripcion || m.DESCRIPCION || ''
                        return <option key={id} value={id}>{`${mat}${col ? ' / '+col : ''}${ds ? ' · '+ds : ''}`}</option>
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
              {manualSum - Number(peso) > 1e-9 && (
                <div className="error">La suma manual no puede superar el peso total.</div>
              )}
            </>
          )}

          {msg && <div className="error">{msg}</div>}
          <div className="form-actions" style={{ justifyContent:'flex-end' }}>
            <button className="btn" disabled={sending || !canSubmit}>
              {sending ? 'Guardando…' : 'Ingresar PT'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
