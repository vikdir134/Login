// frontend/src/components/AddPTModal.jsx
import { useEffect, useMemo, useState, useRef } from 'react'
import {
  fetchProductsLite,
  fetchPrimaryMaterialsLite,
  createFinishedInput
} from '../api/stock'
import { getProductComposition } from '../api/almacen' // tu helper existente

const fmt = (n) => (Number(n)||0).toFixed(2)

/* ─────────────────────────────────────────────────────────────
   Helpers de etiquetas / normalizado
   ───────────────────────────────────────────────────────────── */
const normalize = (s='') => s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase()

const getMaterialLabel = (m) => {
  const id  = m?.id ?? m?.ID_PRIMATER
  const mat = m?.material ?? m?.MATERIAL ?? ''
  const col = m?.color ?? m?.COLOR ?? ''
  const ds  = m?.descripcion ?? m?.DESCRIPCION ?? ''
  const parts = [mat, col && `/${col}`, ds && `· ${ds}`].filter(Boolean)
  const name = parts.join(' ')
  return name ? `${name}` : `MP #${id}`
}

/* ─────────────────────────────────────────────────────────────
   Autocomplete ligero para Materias Primas (por fila)
   ───────────────────────────────────────────────────────────── */
function MPAutocomplete({ value, onChange, materials, label="Materia Prima", placeholder="Escribe para buscar MP…" }) {
  const ref = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hoverIdx, setHoverIdx] = useState(-1)

  // cerrar al click afuera
  useEffect(()=>{
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  },[])

  // etiqueta del seleccionado actual
  const current = useMemo(() => materials.find(m => (m.id ?? m.ID_PRIMATER) === Number(value)), [materials, value])
  const currentLabel = current ? getMaterialLabel(current) : ''

  // resultados
  const results = useMemo(()=>{
    const q = normalize(query)
    if (!q) return []
    const list = materials.map(m => ({ m, label: getMaterialLabel(m) }))
    const starts = []
    const includes = []
    for (const it of list){
      const lbl = normalize(it.label)
      if (lbl.startsWith(q)) starts.push(it)
      else if (lbl.includes(q)) includes.push(it)
    }
    return [...starts, ...includes].slice(0, 30)
  }, [materials, query])

  const choose = (opt) => {
    const id = opt?.m?.id ?? opt?.m?.ID_PRIMATER
    onChange?.(String(id))
    setQuery(getMaterialLabel(opt.m))
    setOpen(false)
  }

  const onKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { setOpen(true); return }
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHoverIdx(i => Math.min(results.length-1, i+1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHoverIdx(i => Math.max(0, i-1)) }
    else if (e.key === 'Enter') { e.preventDefault(); const opt = results[hoverIdx] ?? results[0]; if (opt) choose(opt) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  return (
    <label className="form-field" ref={ref} style={{ position:'relative' }}>
      <span>{label}</span>
      <input
        value={open ? query : (query || currentLabel)}
        onChange={e=>{ setQuery(e.target.value); setOpen(true) }}
        onFocus={()=> setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <div
          className="card"
          style={{
            position:'absolute', left:0, right:0, top:'100%', zIndex:25,
            marginTop:4, maxHeight:320, overflow:'auto', padding:6
          }}
        >
          {results.map((opt, idx)=>(
            <div
              key={opt.m.id ?? opt.m.ID_PRIMATER}
              onMouseEnter={()=>setHoverIdx(idx)}
              onMouseDown={(e)=> e.preventDefault()}
              onClick={()=>choose(opt)}
              style={{
                padding:'8px 10px', borderRadius:10,
                background: idx===hoverIdx ? 'rgba(0,0,0,.06)' : 'transparent',
                cursor:'pointer'
              }}
              title={opt.label}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </label>
  )
}

/* ─────────────────────────────────────────────────────────────
   Componente principal
   ───────────────────────────────────────────────────────────── */
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

  // cargar composición al elegir producto
  useEffect(() => {
    if (!productId) {
      setComposition([])
      setUseComposition(false)
      return
    }
    getProductComposition(productId)
      .then(rows => {
        const list = Array.isArray(rows) ? rows : []
        setComposition(list)
        setUseComposition(list.length > 0)
      })
      .catch(() => { setComposition([]); setUseComposition(false) })
  }, [productId])

  // auto-consumos desde composición
  const autoConsumptions = useMemo(() => {
    const total = Number(peso || 0)
    if (!total || !composition.length) return []
    return composition.map(c => {
      const primId = Number(c.primaterId || c.ID_PRIMATER)
      const perc   = Number(c.percentage || c.PERCENTAGE || 0)
      const zone   = String(c.zone || c.ZONE || 'PRODUCCION')
      const qty    = +(total * (perc / 100)).toFixed(2)
      // buscar nombre en catálogo de MP
      const mp = materials.find(m => (m.id ?? m.ID_PRIMATER) === primId)
      const mpLabel = mp ? getMaterialLabel(mp) : `MP #${primId}`
      return { primaterId: primId, zone, percentage: perc, qty, mpLabel }
    })
  }, [peso, composition, materials])

  const manualSum = useMemo(
    () => consumos.reduce((a, c) => a + Number(c.peso || 0), 0),
    [consumos]
  )

  const canSubmit = useMemo(() => {
    if (!productId || !defaultZoneId || !(+peso > 0)) return false
    if (!useComposition) {
      if (!consumos.length) return false
      if (consumos.some(c => !c.primaterId || !(Number(c.peso) > 0))) return false
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
              disabled={!composition.length}
            />
            <span>Usar composición del producto (si existe)</span>
          </label>

          {useComposition && composition.length > 0 && (
            <div className="card" style={{ background:'transparent', border:'1px dashed var(--border)' }}>
              <div className="muted" style={{ marginBottom:6 }}>Consumo automático (desde zona indicada, por defecto Producción):</div>
              <div className="table">
                <div className="table__head" style={{ gridTemplateColumns:'2fr .7fr 1fr' }}>
                  <div>Materia prima</div>
                  <div>%</div>
                  <div>Consumo (kg)</div>
                </div>
                {autoConsumptions.map((c, i) => (
                  <div key={i} className="table__row" style={{ gridTemplateColumns:'2fr .7fr 1fr' }}>
                    <div>{c.mpLabel} <span className="muted">({c.zone})</span></div>
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
              {consumos.map((c, i) => {
                const selected = materials.find(m => (m.id ?? m.ID_PRIMATER) === Number(c.primaterId))
                return (
                  <div key={i} className="form-row" style={{ gridTemplateColumns:'2fr 1fr auto' }}>
                    {/* Buscador reactivo de MP */}
                    <MPAutocomplete
                      materials={materials}
                      value={c.primaterId}
                      onChange={(id)=> setConsumo(i, { primaterId: id })}
                      label="Materia Prima"
                      placeholder="Escribe para buscar MP…"
                    />
                    <label className="form-field">
                      <span>Peso (kg)</span>
                      <input
                        type="number" step="0.01" min="0.01"
                        value={c.peso}
                        onChange={e => setConsumo(i, { peso: e.target.value })}
                        required
                      />
                    </label>
                    <div className="form-actions">
                      {consumos.length > 1 && (
                        <button type="button" className="btn-secondary" onClick={()=>removeConsumo(i)}>Quitar</button>
                      )}
                    </div>
                  </div>
                )
              })}
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
