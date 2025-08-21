// src/components/MaterialForm.jsx
import { useEffect, useState } from 'react'
import { listMaterials, listColors, createPrimaryMaterial } from '../api/materials'

export default function MaterialForm({ onCreated }) {
  const [materials, setMaterials] = useState([])
  const [colors, setColors] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)

  const [form, setForm] = useState({
    materialId: '',
    colorId: '',
    descripcion: '',
    denier: ''
  })

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([
      listMaterials().catch(()=>[]),
      listColors().catch(()=>[])
    ])
      .then(([m, c]) => { if (alive){ setMaterials(m); setColors(c) } })
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  const onChange = e => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setMsg('')
    if (!form.materialId) { setMsg('Selecciona un material'); return }
    setSending(true)
    try {
      await createPrimaryMaterial({
        materialId: Number(form.materialId),
        colorId: form.colorId ? Number(form.colorId) : null,
        descripcion: form.descripcion || null,
        denier: form.denier ? Number(form.denier) : null
      })
      setMsg('✅ Materia prima creada')
      setForm({ materialId: '', colorId: '', descripcion: '', denier: '' })
      onCreated?.()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error creando materia prima')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="card">
      <h4 style={{marginTop:0}}>Crear Materia Prima</h4>
      {loading ? 'Cargando catálogos…' : (
        <form onSubmit={onSubmit} style={{ display:'grid', gap:12, maxWidth:520 }}>
          <label>Material
            <select name="materialId" value={form.materialId} onChange={onChange} required>
              <option value="">— Selecciona —</option>
              {materials.map(m => <option key={m.id} value={m.id}>{m.name || m.DESCRIPCION}</option>)}
            </select>
          </label>
          <label>Color (opcional)
            <select name="colorId" value={form.colorId} onChange={onChange}>
              <option value="">— Ninguno —</option>
              {colors.map(c => <option key={c.id} value={c.id}>{c.name || c.DESCRIPCION}</option>)}
            </select>
          </label>
          <label>Descripción (opcional)
            <input name="descripcion" value={form.descripcion} onChange={onChange} placeholder="Granulado, hilaza…" />
          </label>
          <label>Denier (opcional)
            <input type="number" min="0" step="1" name="denier" value={form.denier} onChange={onChange} placeholder="600" />
          </label>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn" disabled={sending}>{sending ? 'Guardando…' : 'Crear'}</button>
          </div>
          {msg && <div className="muted">{msg}</div>}
        </form>
      )}
    </div>
  )
}
