// src/components/forms/CreateProductForm.jsx
import { useEffect, useMemo, useState } from 'react'
import { listPrimaryMaterials } from '../../api/primary-materials'
import { createProduct, addCompositions } from '../../api/products'

const ZONES = ['TRONCO','ALMA','CUBIERTA']

export default function CreateProductForm({ onDone }) {
  const [primaters, setPrimaters] = useState([])
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)

  const [p, setP] = useState({ tipoProducto:'', diameter:'', descripcion:'' })
  const [useComp, setUseComp] = useState(false)
  const [items, setItems] = useState([{ primaterId:'', zone:'TRONCO', percentage:'' }])

  useEffect(() => { listPrimaryMaterials().then(setPrimaters).catch(()=>setPrimaters([])) }, [])

  const setItem = (i, patch) => setItems(arr => arr.map((x,ix)=>ix===i?{...x,...patch}:x))
  const addItem = () => setItems(arr => [...arr, { primaterId:'', zone:'TRONCO', percentage:'' }])
  const rmItem = i => setItems(arr => arr.filter((_,ix)=>ix!==i))
  const totalPct = useMemo(()=> items.reduce((a,it)=>a+(+it.percentage||0),0), [items])

  const submit = async (e) => {
    e.preventDefault()
    setMsg('')
    if (!p.tipoProducto || !p.diameter || !p.descripcion) { setMsg('Completa todos los campos'); return }
    if (useComp) {
      for (const it of items) {
        if (!it.primaterId || !it.zone || isNaN(+it.percentage) || +it.percentage<0 || +it.percentage>100) {
          setMsg('Composición inválida (selección y % 0–100).'); return
        }
      }
      // Si quieres forzar 100% exacto descomenta:
      // if (Math.abs(totalPct-100) > 1e-6) { setMsg('La suma de % debe ser 100%'); return }
    }
    setSending(true)
    try {
      const created = await createProduct(p)
      if (useComp && items.length) {
        await addCompositions(created.id, items.map(it=>({
          primaterId: +it.primaterId, zone: it.zone, percentage: +it.percentage
        })))
      }
      setMsg('✅ Producto creado')
      onDone?.()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error creando producto')
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={submit} style={{display:'grid',gap:12}}>
      <label>Tipo de producto
        <input value={p.tipoProducto} onChange={e=>setP(s=>({...s,tipoProducto:e.target.value}))}/>
      </label>
      <label>Diámetro
        <input value={p.diameter} onChange={e=>setP(s=>({...s,diameter:e.target.value}))}/>
      </label>
      <label>Descripción
        <input value={p.descripcion} onChange={e=>setP(s=>({...s,descripcion:e.target.value}))}/>
      </label>

      <label style={{display:'flex',gap:8,alignItems:'center'}}>
        <input type="checkbox" checked={useComp} onChange={e=>setUseComp(e.target.checked)} />
        <span>Agregar composición (opcional)</span>
      </label>

      {useComp && (
        <div className="card">
          <div className="muted" style={{marginBottom:8}}>Zonas: TRONCO / ALMA / CUBIERTA</div>
          {items.map((it,idx)=>(
            <div className="form-row" key={idx}>
              <label className="form-field">
                <span>Materia prima</span>
                <select value={it.primaterId} onChange={e=>setItem(idx,{primaterId:e.target.value})}>
                  <option value="">—</option>
                  {primaters.map(m=><option key={m.id} value={m.id}>{m.name || m.DESCRIPCION || `MP #${m.id}`}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span>Zona</span>
                <select value={it.zone} onChange={e=>setItem(idx,{zone:e.target.value})}>
                  {ZONES.map(z=><option key={z} value={z}>{z}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span>%</span>
                <input type="number" min="0" max="100" step="0.01"
                  value={it.percentage} onChange={e=>setItem(idx,{percentage:e.target.value})}/>
              </label>
              <div className="form-actions" style={{gap:8}}>
                {items.length>1 && <button type="button" className="btn-secondary" onClick={()=>rmItem(idx)}>Quitar</button>}
              </div>
            </div>
          ))}
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <button type="button" className="btn-secondary" onClick={addItem}>+ Ítem</button>
            <div className="muted" style={{alignSelf:'center'}}>Suma: {totalPct.toFixed(2)}%</div>
          </div>
        </div>
      )}

      <button className="btn" disabled={sending}>{sending ? 'Guardando…' : 'Crear producto'}</button>
      {msg && <div className="muted">{msg}</div>}
    </form>
  )
}
