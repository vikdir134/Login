// frontend/src/components/CreateProductModal.jsx
import { useEffect, useState } from 'react'
import api from '../api/axios'

export default function CreateProductModal({ open, onClose, onDone }) {
  const [tipo, setTipo] = useState('')
  const [diameter, setDiameter] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return
    setTipo(''); setDiameter(''); setDescripcion(''); setMsg('')
  }, [open])

  const canSubmit = tipo.trim() && diameter.trim() && descripcion.trim()

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSending(true); setMsg('')
    try {
      await api.post('/api/products', {
        tipoProducto: tipo.trim(),
        diameter: diameter.trim(),
        descripcion: descripcion.trim()
      })
      onDone?.(); onClose?.()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error creando producto')
    } finally { setSending(false) }
  }

  if (!open) return null
  return (
    <div className="modal modal--center">
      <div className="modal__card">
        <div className="modal__header">
          <h4 style={{ margin:0 }}>Crear Producto</h4>
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
        <form onSubmit={submit} className="form-col" style={{ gap:12 }}>
          <label className="form-field">
            <span>Tipo</span>
            <input value={tipo} onChange={e=>setTipo(e.target.value)} required />
          </label>
          <label className="form-field">
            <span>Diámetro</span>
            <input value={diameter} onChange={e=>setDiameter(e.target.value)} required />
          </label>
          <label className="form-field">
            <span>Descripción</span>
            <input value={descripcion} onChange={e=>setDescripcion(e.target.value)} required />
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
