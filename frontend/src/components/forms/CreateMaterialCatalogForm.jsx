// src/components/forms/CreateMaterialCatalogForm.jsx
import { useState } from 'react'
import { createMaterial } from '../../api/catalog'

export default function CreateMaterialCatalogForm({ onDone }) {
  const [name,setName] = useState('')
  const [msg,setMsg] = useState('')
  const [sending,setSending] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setMsg('')
    if (!name.trim()) return setMsg('Escribe un nombre')
    setSending(true)
    try {
      await createMaterial(name.trim())
      setMsg('✅ Material creado')
      setName('')
      onDone?.()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error creando material')
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={submit} style={{display:'grid',gap:12}}>
      <label>Nombre del material
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Polipropileno, Poliéster…"/>
      </label>
      <button className="btn" disabled={sending}>{sending?'Guardando…':'Crear material'}</button>
      {msg && <div className="muted">{msg}</div>}
    </form>
  )
}
