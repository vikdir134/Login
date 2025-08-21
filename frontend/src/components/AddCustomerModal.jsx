import { useEffect, useMemo, useState } from 'react'
import { createCustomer } from '../api/customers'

export default function AddCustomerModal({ open, onClose, onSuccess }) {
  const [saving, setSaving] = useState(false)
  const [apiError, setApiError] = useState('')

  const [form, setForm] = useState({
    RUC: '',
    razonSocial: '',
    phone: '',
    email: '',
    address: '',
    activo: true,
  })

  useEffect(() => {
    if (open) {
      setApiError('')
      setForm({
        RUC: '',
        razonSocial: '',
        phone: '',
        email: '',
        address: '',
        activo: true,
      })
    }
  }, [open])

  const setField = (patch) => setForm(f => ({ ...f, ...patch }))

  // Validación (solo al enviar, pero calculamos aquí para decidir bloqueo del botón)
  const errors = useMemo(() => {
    const e = {}
    // RUC requerido 8..11 (ajusta si tu backend permite 11 exacto)
    const r = (form.RUC || '').trim()
    if (!r) e.RUC = 'RUC es obligatorio'
    else if (r.length < 8 || r.length > 11) e.RUC = 'RUC entre 8 y 11 dígitos'

    // Razón social requerida 2..60 (según tu schema)
    const rs = (form.razonSocial || '').trim()
    if (!rs) e.razonSocial = 'Razón social es obligatoria'
    else if (rs.length < 2) e.razonSocial = 'Mínimo 2 caracteres'
    else if (rs.length > 60) e.razonSocial = 'Máximo 60 caracteres'

    // Email opcional
    const em = (form.email || '').trim()
    if (em) {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)
      if (!ok) e.email = 'Correo no válido'
      if (em.length > 100) e.email = 'Máximo 100 caracteres'
    }
    // Teléfono opcional
    const ph = (form.phone || '').trim()
    if (ph) {
      const ok = /^[0-9+\-\s()]{6,20}$/.test(ph)
      if (!ok) e.phone = 'Teléfono no válido'
    }
    // Dirección opcional
    if (form.address && form.address.length > 150) e.address = 'Máximo 150 caracteres'

    return e
  }, [form])

  const canSubmit = useMemo(() => Object.keys(errors).length === 0 && !saving, [errors, saving])

  const submit = async (e) => {
    e.preventDefault()
    setApiError('') // limpiamos
    // No pintamos en rojo; si hay error mostramos mensaje general
    if (!canSubmit) {
      setApiError('Revisa los datos obligatorios antes de registrar.')
      return
    }
    setSaving(true)
    try {
      // Backend: CUSTOMERS => { RUC, RAZON_SOCIAL, ACTIVO } [+ campos extra si tu controlador los soporta]
      await createCustomer({
        RUC: form.RUC.trim(),
        razonSocial: form.razonSocial.trim(),
        phone: form.phone?.trim() || null,
        email: form.email?.trim() || null,
        address: form.address?.trim() || null,
        activo: !!form.activo
      })
      onSuccess?.()
      onClose?.()
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        (err.response?.status === 409 ? 'RUC o Razón social ya registrados' : null) ||
        err.message ||
        'Error creando cliente'
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
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)',
        display: 'grid', placeItems: 'center', zIndex: 1000
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 600 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
          <h4 style={{ margin:0 }}>Nuevo cliente</h4>
          <button type="button" className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>

        <form onSubmit={submit} style={{ display:'grid', gap:12, marginTop:12 }}>
          <div className="form-row" style={{ gridTemplateColumns:'1fr 2fr' }}>
            <label className="form-field">
              <span>RUC *</span>
              <input
                value={form.RUC}
                onChange={e => setField({ RUC: e.target.value })}
                placeholder="20123456789"
              />
            </label>
            <label className="form-field">
              <span>Razón social *</span>
              <input
                value={form.razonSocial}
                onChange={e => setField({ razonSocial: e.target.value })}
                placeholder="ACME S.A.C."
              />
            </label>
          </div>

          <div className="form-row" style={{ gridTemplateColumns:'1fr 1fr' }}>
            <label className="form-field">
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={e => setField({ email: e.target.value })}
                placeholder="cliente@empresa.com"
              />
            </label>
            <label className="form-field">
              <span>Teléfono</span>
              <input
                value={form.phone}
                onChange={e => setField({ phone: e.target.value })}
                placeholder="+51 999 999 999"
              />
            </label>
          </div>

          <label className="form-field">
            <span>Dirección</span>
            <input
              value={form.address}
              onChange={e => setField({ address: e.target.value })}
              placeholder="Av. Siempre Viva 742"
            />
          </label>

          <label className="form-field" style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input
              type="checkbox"
              checked={form.activo}
              onChange={e => setField({ activo: e.target.checked })}
              style={{ width:18, height:18 }}
            />
            <span>Activo</span>
          </label>

          {/* Mensaje de error general solo al enviar */}
          {apiError && <div className="error">{apiError}</div>}

          <div style={{ display:'flex', gap:8 }}>
            <div style={{ flex:1 }} />
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn" disabled={!canSubmit}>
              {saving ? 'Guardando…' : 'Registrar'}
            </button>
          </div>
        </form>

        {/* Sugerencias si quisieras mostrar qué falló sin “pintar” inputs */}
        {(Object.keys(errors).length > 0 && !apiError) && (
          <div className="muted" style={{ marginTop:8 }}>
            Faltan datos: {Object.values(errors).join(' · ')}
          </div>
        )}
      </div>
    </div>
  )
}
