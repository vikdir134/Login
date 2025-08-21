// src/components/forms/CreatePrimaryMaterialForm.jsx
import { useEffect, useState } from 'react'
import { listMaterials, listColors } from '../../api/catalog'
import { createPrimaryMaterial } from '../../api/primary-materials'

export default function CreatePrimaryMaterialForm({ onDone }) {
  const [materials, setMaterials] = useState([])
  const [colors, setColors] = useState([])
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [f, setF] = useState({ materialId:'', colorId:'', descripcion:'', denier:'' })

  useEffect(() => {
    Promise.all([listMaterials().catch(()=>[]), listColors().catch(()=>[])])
      .then(([m,c]) => { setMaterials(m); setColors(c) })
  }, [])

  const onChange = e => {
    const { name, value } = e.target
    setF(s => ({ ...s, [name]: value }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setMsg('')
    if (!f.materialId) { setMsg('Selecciona material'); return }
    setSending(true)
    try {
      await createPrimaryMaterial({
        materialId: Number(f.materialId),
        colorId: f.colorId ? Number(f.colorId) : null,
        descripcion: f.descripcion || null,
        denier: f.denier ? Number(f.denier) : null
      })
      setMsg('✅ Creado')
      onDone?.()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error creando materia prima')
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} style={{display:'grid',gap:12}}>
      <label>Material
        <select name="materialId" value={f.materialId} onChange={onChange} required>
          <option value="">—</option>
          {materials.map(m => <option key={m.id} value={m.id}>{m.name || m.DESCRIPCION}</option>)}
        </select>
      </label>
      <label>Color (opcional)
        <select name="colorId" value={f.colorId} onChange={onChange}>
          <option value="">—</option>
          {colors.map(c => <option key={c.id} value={c.id}>{c.name || c.DESCRIPCION}</option>)}
        </select>
      </label>
      <label>Descripción (opcional)
        <input name="descripcion" value={f.descripcion} onChange={onChange} placeholder="Granulado / Hilaza…" />
      </label>
      <label>Denier (opcional)
        <input type="number" min="0" step="1" name="denier" value={f.denier} onChange={onChange} />
      </label>
      <button className="btn" disabled={sending}>{sending ? 'Guardando…' : 'Crear'}</button>
      {msg && <div className="muted">{msg}</div>}
    </form>
  )
}
