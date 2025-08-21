// src/components/forms/MoveStockForm.jsx
import { useEffect, useState } from 'react'
import { listZones, moveStock } from '../../api/stock'
import { listPrimaryMaterials } from '../../api/primary-materials'
import { listProducts } from '../../api/products'

export default function MoveStockForm({ onDone }) {
  const [zones,setZones] = useState([])
  const [mp,setMp] = useState([])
  const [prods,setProds] = useState([])
  const [msg,setMsg] = useState('')
  const [sending,setSending] = useState(false)

  const [type,setType] = useState('PRIMARY') // PRIMARY | FINISHED
  const [f,setF] = useState({ itemId:'', fromZoneId:'', toZoneId:'', peso:'', observacion:'' })

  useEffect(()=>{
    Promise.all([listZones().catch(()=>[]), listPrimaryMaterials().catch(()=>[]), listProducts().catch(()=>[])])
      .then(([z,m,p])=>{ setZones(z); setMp(m); setProds(p) })
  },[])

  const onChange = e => setF(s=>({ ...s, [e.target.name]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setMsg('')
    if (!f.itemId || !f.fromZoneId || !f.toZoneId || !(+f.peso>0)) { setMsg('Completa todos los campos'); return }
    if (f.fromZoneId === f.toZoneId) { setMsg('Selecciona zonas distintas'); return }
    setSending(true)
    try {
      await moveStock({
        type,
        itemId: +f.itemId,
        fromZoneId:+f.fromZoneId,
        toZoneId:+f.toZoneId,
        peso:+f.peso,
        observacion:f.observacion||null
      })
      setMsg('✅ Movimiento registrado')
      onDone?.()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error moviendo stock')
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} style={{display:'grid',gap:12}}>
      <label>Tipo
        <select value={type} onChange={e=>setType(e.target.value)}>
          <option value="PRIMARY">Materia Prima</option>
          <option value="FINISHED">Producto Terminado</option>
        </select>
      </label>

      <label>Ítem
        <select name="itemId" value={f.itemId} onChange={onChange}>
          <option value="">—</option>
          {(type==='PRIMARY'? mp:prods).map(x=>(
            <option key={x.id} value={x.id}>{x.name || x.DESCRIPCION || (type==='PRIMARY'?'MP':'Prod')+' #'+x.id}</option>
          ))}
        </select>
      </label>

      <div className="form-row" style={{gridTemplateColumns:'1fr 1fr 1fr auto'}}>
        <label className="form-field">
          <span>Desde</span>
          <select name="fromZoneId" value={f.fromZoneId} onChange={onChange}>
            <option value="">—</option>
            {zones.map(z=><option key={z.id} value={z.id}>{z.name || z.NOMBRE}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>Hacia</span>
          <select name="toZoneId" value={f.toZoneId} onChange={onChange}>
            <option value="">—</option>
            {zones.map(z=><option key={z.id} value={z.id}>{z.name || z.NOMBRE}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>Peso (kg)</span>
          <input name="peso" type="number" step="0.01" min="0.01" value={f.peso} onChange={onChange}/>
        </label>
        <div className="form-actions"></div>
      </div>

      <label>Observación
        <input name="observacion" value={f.observacion} onChange={onChange}/>
      </label>

      <button className="btn" disabled={sending}>{sending?'Guardando…':'Mover'}</button>
      {msg && <div className="muted">{msg}</div>}
    </form>
  )
}
