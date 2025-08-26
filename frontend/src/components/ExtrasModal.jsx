// frontend/src/components/ExtrasModal.jsx
import { useEffect, useState } from 'react'
import { createColor, createMaterial } from '../api/extras'

export default function ExtrasModal({ open, onClose }) {
  const [tab, setTab] = useState('COLOR')
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return
    setTab('COLOR'); setName(''); setMsg('')
  }, [open])

  const submit = async (e) => {
    e.preventDefault(); setMsg(''); setSending(true)
    try {
      if (!name.trim()) throw new Error('Nombre requerido')
      if (tab === 'COLOR') {
        await createColor(name.trim())
        setMsg('✅ Color creado')
      } else {
        await createMaterial(name.trim())
        setMsg('✅ Material creado')
      }
    } catch (err) {
      setMsg(err?.response?.data?.error || err.message || 'Error')
    } finally {
      setSending(false)
    }
  }

  if (!open) return null
  return (
    <div className="modal modal--center">
      <div className="modal__card">
        <div className="modal__header">
          <h4 style={{ margin:0 }}>Extras</h4>
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>

        <div style={{ display:'flex', gap:6, marginBottom:8 }}>
          <button className={tab==='COLOR'?'btn':'btn-secondary'} onClick={()=>setTab('COLOR')}>Agregar Color</button>
          <button className={tab==='MATERIAL'?'btn':'btn-secondary'} onClick={()=>setTab('MATERIAL')}>Agregar Material</button>
        </div>

        <form onSubmit={submit} className="form-col" style={{ gap:12 }}>
          <label className="form-field">
            <span>Nombre</span>
            <input value={name} onChange={e=>setName(e.target.value)} required />
          </label>

          {msg && <div className={/✅/.test(msg)?'muted':'error'}>{msg}</div>}
          <div className="form-actions" style={{ justifyContent:'flex-end' }}>
            <button className="btn" disabled={sending}>{sending ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
