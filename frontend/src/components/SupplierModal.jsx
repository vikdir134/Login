import { useState } from 'react'

export default function SupplierModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    ruc: '',
    address: '',
    phone: '',
    email: '',
    contactPerson: '',
    active: true
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  if (!open) return null

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setMsg('')
    if (!form.name.trim()) { setMsg('El nombre es obligatorio'); return }
    try {
      setSaving(true)
      await onCreated(form)        // lo maneja el padre
      onClose()
      // opcional: reset
      setForm({ name:'', ruc:'', address:'', phone:'', email:'', contactPerson:'', active:true })
    } catch (err) {
      setMsg(err?.response?.data?.error || 'Error creando proveedor')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,.35)',
      display:'grid', placeItems:'center', zIndex:1000
    }}>
      <div className="card" style={{ maxWidth: 560, width:'100%' }}>
        <h3 style={{ marginTop:0 }}>Nuevo proveedor</h3>
        <form onSubmit={submit} style={{ display:'grid', gap:12 }}>
          <label>
            Nombre / Razón social *
            <input value={form.name} onChange={e=>set('name', e.target.value)} required />
          </label>
          <div style={{ display:'grid', gap:12, gridTemplateColumns:'1fr 1fr' }}>
            <label>
              RUC
              <input value={form.ruc} onChange={e=>set('ruc', e.target.value)} />
            </label>
            <label>
              Contacto
              <input value={form.contactPerson} onChange={e=>set('contactPerson', e.target.value)} />
            </label>
          </div>
          <label>
            Dirección
            <input value={form.address} onChange={e=>set('address', e.target.value)} />
          </label>
          <div style={{ display:'grid', gap:12, gridTemplateColumns:'1fr 1fr' }}>
            <label>
              Teléfono
              <input value={form.phone} onChange={e=>set('phone', e.target.value)} />
            </label>
            <label>
              Email
              <input type="email" value={form.email} onChange={e=>set('email', e.target.value)} />
            </label>
          </div>

          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </div>

          {msg && <div className="error">{msg}</div>}
        </form>
      </div>
    </div>
  )
}
