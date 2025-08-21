// src/components/forms/AddPrimaryStockForm.jsx
import { useEffect, useState } from 'react'
import { listPrimaryMaterials } from '../../api/primary-materials'
import { listZones, addPrimaryStock } from '../../api/stock'

export default function AddPrimaryStockForm({ onDone }) {
  const [mp, setMp] = useState([])
  const [zones, setZones] = useState([])
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [f, setF] = useState({ primaterId:'', zoneId:'', peso:'', observacion:'' })

  useEffect(()=>{
    Promise.all([listPrimaryMaterials().catch(()=>[]), listZones().catch(()=>[])])
      .then(([m,z])=>{ setMp(m); setZones(z) })
  },[])

  const onChange = e => setF(s=>({ ...s, [e.target.name]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setMsg('')
    if (!f.primaterId || !f.zoneId || !(+f.peso>0)) { setMsg('Completa ítem, zona y peso'); return }
    setSending(true)
    try {
      await addPrimaryStock({ primaterId:+f.primaterId, zoneId:+f.zoneId, peso:+f.peso, observacion: f.observacion||null })
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
      <label>Materia prima
        <select name="primaterId" value={f.primaterId} onChange={onChange} required>
          <option value="">—</option>
          {mp.map(x=><option key={x.id} value={x.id}>{x.name || x.DESCRIPCION || `MP #${x.id}`}</option>)}
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
