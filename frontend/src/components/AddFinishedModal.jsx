import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import {
  fetchSpaces, fetchProducts, fetchPresentations,
  createPresentation, fetchPrimaryMaterials, inputFinishedProduct
} from '../api/stock'

export default function AddFinishedModal({ open, onClose, onDone }) {
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [spaces, setSpaces] = useState([])           // ALMACEN
  const [products, setProducts] = useState([])
  const [presentations, setPresentations] = useState([])
  const [primaries, setPrimaries] = useState([])

  const [form, setForm] = useState({
    zoneId: '',            // debe ser ALMACEN
    productId: '',
    peso: '',
    useComposition: true,  // si el producto no tiene comp, el back validará
    presentationId: '',
    presentationKg: '',    // alternativo si no hay catálogo
    consumos: []           // [{primaterId, peso}]
  })

  // cargar catálogos base
  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    Promise.all([
      fetchSpaces('ALMACEN').catch(()=>[]),
      fetchProducts().catch(()=>[]),
      fetchPrimaryMaterials().catch(()=>[])
    ]).then(([zs, ps, pms]) => {
      if (!alive) return
      setSpaces(zs || [])
      setProducts(ps || [])
      setPrimaries(pms || [])
      setMsg('')
    }).catch(() => setMsg('No se pudieron cargar catálogos'))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [open])

  // al elegir producto, pedir presentaciones
  useEffect(() => {
    if (!form.productId) { setPresentations([]); return }
    fetchPresentations(Number(form.productId))
      .then(setPresentations)
      .catch(() => setPresentations([]))
  }, [form.productId])

  const sumConsumos = useMemo(
    () => (form.consumos || []).reduce((a, c) => a + Number(c.peso || 0), 0),
    [form.consumos]
  )
  const excedeConsumo = Number(sumConsumos) > Number(form.peso || 0) + 1e-9

  const addConsumo = () =>
    setForm(f => ({ ...f, consumos: [...(f.consumos||[]), { primaterId: '', peso: '' }] }))
  const setConsumo = (idx, patch) =>
    setForm(f => ({ ...f, consumos: f.consumos.map((c,i)=> i===idx ? { ...c, ...patch } : c) }))
  const removeConsumo = (idx) =>
    setForm(f => ({ ...f, consumos: f.consumos.filter((_,i)=> i!==idx) }))

  const canSubmit = useMemo(() => {
    if (!form.zoneId || !form.productId || !(+form.peso > 0)) return false
    // presentación: id o kg opcional (si no se exige catálogo)
    if (!form.presentationId && !(+form.presentationKg > 0)) return false
    if (!form.useComposition) {
      if (!form.consumos || form.consumos.length === 0) return false
      if (excedeConsumo) return false
    }
    return true
  }, [form, excedeConsumo])

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setMsg('')
    try {
      const payload = {
        productId: Number(form.productId),
        zoneId: Number(form.zoneId),
        peso: Number(form.peso),
        useComposition: !!form.useComposition,
        presentationId: form.presentationId ? Number(form.presentationId) : undefined,
        presentationKg: form.presentationKg ? Number(form.presentationKg) : undefined,
        consumos: form.useComposition ? undefined : form.consumos.map(c => ({
          primaterId: Number(c.primaterId),
          peso: Number(c.peso)
        }))
      }
      await inputFinishedProduct(payload)
      onDone?.()
      onClose()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error al ingresar PT')
    }
  }

  const createNewPresentation = async () => {
    setMsg('')
    try {
      if (!form.productId || !(+form.presentationKg > 0)) {
        setMsg('Indica producto y presentación (kg)')
        return
      }
      const data = await createPresentation({
        productId: Number(form.productId),
        pesoKg: Number(form.presentationKg)
      })
      // refrescar catálogo y seleccionar la nueva
      const list = await fetchPresentations(Number(form.productId))
      setPresentations(list)
      setForm(f => ({ ...f, presentationId: data.id?.toString?.() || '' }))
      setMsg('✅ Presentación creada')
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error creando presentación')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Ingresar Producto Terminado" wide>
      {loading ? <div className="muted">Cargando…</div> : (
        <form onSubmit={submit} style={{ display:'grid', gap:12 }}>
          <div className="grid-3">
            <label>
              Zona (ALMACEN)
              <select
                value={form.zoneId}
                onChange={e => setForm(f => ({ ...f, zoneId: e.target.value }))}
                required
              >
                <option value="">—</option>
                {spaces.map(z => <option key={z.id} value={z.id}>{z.NOMBRE || z.name || `Almacén #${z.id}`}</option>)}
              </select>
            </label>

            <label>
              Producto
              <select
                value={form.productId}
                onChange={e => setForm(f => ({ ...f, productId: e.target.value, presentationId:'', presentationKg:'' }))}
                required
              >
                <option value="">—</option>
                {products.map(p => (
                  <option key={p.ID_PRODUCT || p.id} value={p.ID_PRODUCT || p.id}>
                    {p.DESCRIPCION || p.name || `Producto #${p.id}`}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Peso total (kg)
              <input type="number" step="0.01" min="0.01"
                value={form.peso}
                onChange={e => setForm(f => ({ ...f, peso: e.target.value }))}
                required
              />
            </label>
          </div>

          <div className="grid-3">
            <label>
              Presentación (catálogo)
              <select
                value={form.presentationId}
                onChange={e => setForm(f => ({ ...f, presentationId: e.target.value }))}
              >
                <option value="">—</option>
                {presentations.map(pr => (
                  <option key={pr.id} value={pr.id}>{Number(pr.pesoKg).toFixed(2)} kg</option>
                ))}
              </select>
            </label>

            <label>
              Presentación (kg) nueva
              <input
                type="number" step="0.01" min="0"
                value={form.presentationKg}
                onChange={e => setForm(f => ({ ...f, presentationKg: e.target.value }))}
                placeholder="10, 20, 25…"
              />
            </label>

            <div style={{ display:'flex', alignItems:'end', gap:8 }}>
              <button type="button" className="btn-secondary" onClick={createNewPresentation}>
                + Crear presentación
              </button>
            </div>
          </div>

          <label style={{ display:'flex', gap:8, alignItems:'center' }}>
            <input
              type="checkbox"
              checked={!!form.useComposition}
              onChange={e => setForm(f => ({ ...f, useComposition: e.target.checked, consumos: [] }))}
            />
            Usar composición del producto (si existe)
          </label>

          {!form.useComposition && (
            <div className="card" style={{ padding:12 }}>
              <div className="muted">Consumo manual de MP (no exceder el peso total del PT)</div>
              {form.consumos.map((c, idx) => (
                <div key={idx} className="form-row" style={{ marginTop:8 }}>
                  <label className="form-field">
                    <span>Materia prima</span>
                    <select value={c.primaterId}
                      onChange={e => setConsumo(idx, { primaterId: e.target.value })}
                      required>
                      <option value="">—</option>
                      {primaries.map(pm => (
                        <option key={pm.ID_PRIMATER || pm.id} value={pm.ID_PRIMATER || pm.id}>
                          {pm.DESCRIPCION || pm.name || `MP #${pm.id}`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Peso (kg)</span>
                    <input type="number" step="0.01" min="0.01" value={c.peso}
                      onChange={e => setConsumo(idx, { peso: e.target.value })} required />
                  </label>
                  <div className="form-actions" style={{ gap:8 }}>
                    <button type="button" className="btn-secondary" onClick={() => removeConsumo(idx)}>Quitar</button>
                  </div>
                </div>
              ))}
              <div style={{ display:'flex', gap:8, marginTop:8 }}>
                <button type="button" className="btn-secondary" onClick={addConsumo}>+ Consumo</button>
                <div className="muted" style={{ alignSelf:'center' }}>
                  Suma consumos: <strong>{sumConsumos.toFixed(2)} kg</strong>
                </div>
              </div>
              {excedeConsumo && (
                <div className="error" style={{ marginTop:8 }}>
                  La suma de consumos no puede exceder el peso total del PT.
                </div>
              )}
            </div>
          )}

          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn" disabled={!canSubmit}>Guardar</button>
          </div>

          {msg && <div className="muted" style={{ marginTop:8 }}>{msg}</div>}
        </form>
      )}
    </Modal>
  )
}
