// frontend/src/components/CreatePrimaryMaterialModal.jsx
import { useEffect, useState } from 'react'
import api from '../api/axios'

export default function CreatePrimaryMaterialModal({ open, onClose, onDone }) {
  const [materials, setMaterials] = useState([])
  const [colors, setColors] = useState([])

  const [materialId, setMaterialId] = useState('')
  const [colorId, setColorId] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [denier, setDenier] = useState('')
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return
    setMsg('')
    api.get('/api/materials').then(r=>setMaterials(r.data||[])).catch(()=>setMaterials([]))
    api.get('/api/colors').then(r=>setColors(r.data||[])).catch(()=>setColors([]))
    setMaterialId(''); setColorId(''); setDescripcion(''); setDenier('')
  }, [open])

  const canSubmit = Number(materialId) > 0

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSending(true); setMsg('')
    try {
      await api.post('/api/primary-materials', {
        materialId: Number(materialId),
        colorId: colorId ? Number(colorId) : null,
        descripcion: descripcion || null,
        denier: denier ? Number(denier) : null
      })
      onDone?.(); onClose?.()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error creando MP')
    } finally { setSending(false) }
  }

  if (!open) return null
  return (
    <div className="modal modal--center">
      <div className="modal__card">
        <div className="modal__header">
          <h4 style={{ margin:0 }}>Crear Materia Prima</h4>
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
        <form onSubmit={submit} className="form-col" style={{ gap:12 }}>
          <label className="form-field">
            <span>Material</span>
            <select value={materialId} onChange={e=>setMaterialId(e.target.value)} required>
              <option value="">—</option>
              {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Color</span>
            <select value={colorId} onChange={e=>setColorId(e.target.value)}>
              <option value="">— (sin color)</option>
              {colors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Descripción (opcional)</span>
            <input value={descripcion} onChange={e=>setDescripcion(e.target.value)} placeholder="e.g. Rafia" />
          </label>
          <label className="form-field">
            <span>Denier (opcional)</span>
            <input type="number" step="1" min="0" value={denier} onChange={e=>setDenier(e.target.value)} />
          </label>

          {msg && <div className="error">{msg}</div>}
          <div className="form-actions" style={{ justifyContent:'flex-end' }}>
            <button className="btn" disabled={!canSubmit || sending}>
              {sending ? 'Guardando…' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
