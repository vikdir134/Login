// src/pages/RegistroUsuarios.jsx
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import api from '../api/axios'
import { getUserFromToken, hasRole } from '../utils/auth'

export default function RegistroUsuarios() {
  const me = getUserFromToken()
  const isAdmin = hasRole(me, 'ADMINISTRADOR')

  // ✅ Hooks siempre arriba
  const [roles, setRoles] = useState(['ALMACENERO','PRODUCCION','JEFE','ADMINISTRADOR']) // fallback
  const [loadingRoles, setLoadingRoles] = useState(true)
  const [msg, setMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState('idle') // 'idle' | 'ok' | 'error'

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    phone: '',
    role: 'ALMACENERO',
  })

  // ✅ El efecto va ANTES de cualquier return condicional
  //    y solo corre si es admin (evita llamadas innecesarias).
  useEffect(() => {
    if (!isAdmin) return
    let alive = true
    setLoadingRoles(true)
    api.get('/api/admin/roles')
      .then(({ data }) => {
        if (!alive) return
        const names = Array.isArray(data) ? data.map(r => r.name) : []
        if (names.length) {
          setRoles(names)
          setForm(f => ({ ...f, role: names.includes(f.role) ? f.role : names[0] }))
        }
      })
      .catch(() => setMsg('No se pudieron cargar los roles (usando valores por defecto)'))
      .finally(() => alive && setLoadingRoles(false))
    return () => { alive = false }
  }, [isAdmin])

  // ✅ Return condicional después de declarar hooks/efectos
  if (!isAdmin) {
    return <Navigate to="/app" replace />
  }

  const onChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setMsg('')
    setStatus('idle')
    setSubmitting(true)
    try {
      const { first_name, last_name, email, password } = form
      if (!first_name.trim() || !last_name.trim() || !email.trim() || !password.trim()) {
        setStatus('error')
        setMsg('Completa nombre, apellido, email y contraseña')
        setSubmitting(false)
        return
      }

      const { data } = await api.post('/api/admin/users', form)
      setStatus('ok')
      setMsg(`✅ Usuario creado: ${data.user?.email || ''}`)

      setForm(f => ({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        phone: '',
        role: f.role,
      }))
    } catch (err) {
      const apiMsg = err.response?.data?.error || 'Error al crear usuario'
      setStatus('error')
      setMsg(apiMsg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="card">
      <h3 style={{ marginTop: 0 }}>Registro de usuarios</h3>
      <p className="muted" style={{ marginTop: -6 }}>
        Solo visible para <strong>ADMINISTRADOR</strong>.
      </p>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, maxWidth: 520 }}>
        <label>Nombre
          <input name="first_name" value={form.first_name} onChange={onChange} required />
        </label>
        <label>Apellido
          <input name="last_name" value={form.last_name} onChange={onChange} required />
        </label>
        <label>Email
          <input type="email" name="email" value={form.email} onChange={onChange} required />
        </label>
        <label>Contraseña
          <input type="password" name="password" value={form.password} onChange={onChange} required minLength={6} />
        </label>
        <label>Celular
          <input name="phone" value={form.phone} onChange={onChange} placeholder="+51 9XX XXX XXX" />
        </label>

        <label>Rol
          <select name="role" value={form.role} onChange={onChange} required disabled={loadingRoles}>
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? 'Creando…' : 'Crear usuario'}
          </button>
        </div>

        {msg && (
          <div
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              border: status === 'ok' ? '1px solid #10b981' : '1px solid #ef4444',
              background: status === 'ok' ? 'rgba(16,185,129,.08)' : 'rgba(239,68,68,.08)',
            }}
          >
            {msg}
          </div>
        )}
      </form>
    </section>
  )
}
