// src/components/forms/AddFinishedStockForm.jsx
import { useEffect, useState } from 'react'
import { listProducts } from '../../api/products'
import { listZones, addFinishedStock } from '../../api/stock'

export default function AddFinishedStockForm({ onDone }) {
  const [products, setProducts] = useState([])
  const [zones, setZones] = useState([])
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [f, setF] = useState({ productId:'', zoneId:'', peso:'', observacion:'' })

  useEffect(()=>{
    Promise.all([listProducts().catch(()=>[]), listZones().catch(()=>[])])
      .then(([p,z])=>{ setProducts(p); setZones(z) })
  },[])

  const onChange = e => setF(s=>({ ...s, [e.target.name]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setMsg('')
    if (!f.productId || !f.zoneId || !(+f.peso>0)) { setMsg('Completa ítem, zona y peso'); return }
    setSending(true)
    try {
      await addFinishedStock({ productId:+f.productId, zoneId:+f.zoneId, peso:+f.peso, observacion:f.observacion||null })
      setMsg('✅ Stock agregado')
      onDone?.()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error agregando stock')
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} style={{display:'grid',gap:12}}>
      <label>Producto terminado
        <select name="productId" value={f.productId} onChange={onChange} required>
          <option value="">—</option>
          {products.map(p=><option key={p.id} value={p.id}>{p.name || p.DESCRIPCION || `Prod #${p.id}`}</option>)}
        </select>
      </label>
      <label>Zona
        <select name="zoneId" value={f.zoneId} onChange={onChange} required>
          <option value="">—</option>
          {zones.map(z=><option key={z.id} value={z.id}>{z.name || z.NOMBRE}</option>)}
        </select>
      </label>
      <label>Peso (kg)
        <input name="peso" type="number" step="0.01" min="0.01" value={f.peso} onChange={onChange}/>
      </label>
      <label>Observación (opcional)
        <input name="observacion" value={f.observacion} onChange={onChange}/>
      </label>
      <button className="btn" disabled={sending}>{sending?'Guardando…':'Agregar'}</button>
      {msg && <div className="muted">{msg}</div>}
    </form>
  )
}
