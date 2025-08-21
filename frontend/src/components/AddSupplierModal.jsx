// src/components/AddSupplierModal.jsx
import { useEffect, useMemo, useState } from 'react'
import { createSupplier } from '../api/suppliers'

export default function AddSupplierModal({ open, onClose, onSuccess }) {
  const [saving, setSaving] = useState(false)
  const [apiError, setApiError] = useState('')
  const [form, setForm] = useState({
    name: '',
    ruc: '',
    address: '',
    phone: '',
    email: '',
    contact: '',
    active: true,
  })

  useEffect(() => {
    if (open) {
      setApiError('')
      setForm({
        name: '',
        ruc: '',
        address: '',
        phone: '',
        email: '',
        contact: '',
        active: true,
      })
    }
  }, [open])

  const setField = (patch) => setForm(f => ({ ...f, ...patch }))

  // ---------- Validaciones ----------
  const errors = useMemo(() => {
    const e = {}

    // Nombre: requerido 2..100
    if (!form.name || form.name.trim().length < 2) {
      e.name = 'Ingresa un nombre válido (mín. 2 caracteres)'
    } else if (form.name.trim().length > 100) {
      e.name = 'Máx. 100 caracteres'
    }

    // RUC: requerido 8..20 (según backend actual)
    const ruc = (form.ruc || '').trim()
    if (!ruc) {
      e.ruc = 'El RUC es obligatorio'
    } else if (ruc.length < 8 || ruc.length > 20) {
      e.ruc = 'RUC entre 8 y 20 caracteres'
    }

    // Email: opcional pero con formato
    const email = (form.email || '').trim()
    if (email) {
      // validación sencilla
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      if (!emailOk) e.email = 'Correo no válido'
      if (email.length > 100) e.email = 'Máx. 100 caracteres'
    }

    // Teléfono: opcional; numérico/+-/espacios
    const phone = (form.phone || '').trim()
    if (phone) {
      const phoneOk = /^[0-9+\-\s()]{6,20}$/.test(phone)
      if (!phoneOk) e.phone = 'Teléfono no válido'
    }

    // Contacto: opcional
    if (form.contact && form.contact.length > 100) {
      e.contact = 'Máx. 100 caracteres'
    }

    // Dirección: opcional
    if (form.address && form.address.length > 150) {
      e.address = 'Máx. 150 caracteres'
    }

    return e
  }, [form])

  const canSubmit = useMemo(() => {
    return !saving && Object.keys(errors).length === 0
  }, [saving, errors])

  const submit = async (e) => {
    e.preventDefault()
    setApiError('')
    if (!canSubmit) return
    setSaving(true)

    try {
      // Backend actual espera: { ruc, name, address, phone, email, contact, active }
      await createSupplier({
        ruc: form.ruc.trim(),
        name: form.name.trim(),
        address: form.address?.trim() || null,
        phone: form.phone?.trim() || null,
        email: form.email?.trim() || null,
        contact: form.contact?.trim() || null,
        active: !!form.active
      })

      // refrescar catálogos de proveedores en el padre
      onSuccess?.()
      onClose?.()
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        (err.response?.status === 409 ? 'RUC ya registrado' : null) ||
        err.message ||
        'Error creando proveedor'
      setApiError(msg)
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,.35)',
        display:'grid', placeItems:'center', zIndex:1000
      }}
      onClick={(e)=>{ if (e.target === e.currentTarget) onClose?.() }}
    >
      <div className="card" style={{ width:'100%', maxWidth:560 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
          <h4 style={{ margin:0 }}>Nuevo proveedor</h4>
          <button type="button" className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>

        <form onSubmit={submit} style={{ display:'grid', gap:12, marginTop:12 }}>
          <div className="form-row" style={{ gridTemplateColumns:'2fr 1fr' }}>
            <label className="form-field">
              <span>Nombre/Razón social *</span>
              <input
                value={form.name}
                onChange={e => setField({ name: e.target.value })}
                placeholder="ACME S.A.C."
                required
              />
              {errors.name && <div className="error">{errors.name}</div>}
            </label>

            <label className="form-field">
              <span>RUC *</span>
              <input
                value={form.ruc}
                onChange={e => setField({ ruc: e.target.value })}
                placeholder="20123456789"
                required
              />
              {errors.ruc && <div className="error">{errors.ruc}</div>}
            </label>
          </div>

          <div className="form-row" style={{ gridTemplateColumns:'1fr 1fr' }}>
            <label className="form-field">
              <span>Correo</span>
              <input
                type="email"
                value={form.email}
                onChange={e => setField({ email: e.target.value })}
                placeholder="proveedor@empresa.com"
              />
              {errors.email && <div className="error">{errors.email}</div>}
            </label>

            <label className="form-field">
              <span>Teléfono</span>
              <input
                value={form.phone}
                onChange={e => setField({ phone: e.target.value })}
                placeholder="+51 999 999 999"
              />
              {errors.phone && <div className="error">{errors.phone}</div>}
            </label>
          </div>

          <div className="form-row" style={{ gridTemplateColumns:'1fr 1fr' }}>
            <label className="form-field">
              <span>Dirección</span>
              <input
                value={form.address}
                onChange={e => setField({ address: e.target.value })}
                placeholder="Av. Siempre Viva 742"
              />
              {errors.address && <div className="error">{errors.address}</div>}
            </label>

            <label className="form-field">
              <span>Contacto</span>
              <input
                value={form.contact}
                onChange={e => setField({ contact: e.target.value })}
                placeholder="Nombre del contacto"
              />
              {errors.contact && <div className="error">{errors.contact}</div>}
            </label>
          </div>

          <label className="form-field" style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={e => setField({ active: e.target.checked })}
              style={{ width:18, height:18 }}
            />
            <span>Activo</span>
          </label>

          {apiError && <div className="error">{apiError}</div>}

          <div style={{ display:'flex', gap:8 }}>
            <div style={{ flex:1 }} />
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn" disabled={!canSubmit}>
              {saving ? 'Guardando…' : 'Crear proveedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
