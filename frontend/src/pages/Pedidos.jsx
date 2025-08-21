import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listOrders, createOrderApi } from '../api/orders'
import { hasRole, getUserFromToken } from '../utils/auth'
import { fetchCustomers } from '../api/customers'
import api from '../api/axios'

export default function Pedidos() {
  const me = getUserFromToken()
  const puedeCrear = hasRole(me, 'PRODUCCION') || hasRole(me, 'JEFE') || hasRole(me, 'ADMINISTRADOR')

  // ====== filtros ======
  const [q, setQ] = useState('')
  const [state, setState] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [msg, setMsg] = useState('')

  // ====== catálogo básico para select (clientes y productos) - solo para crear rápido ======
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])

  // ====== crear pedido (simple) ======
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    customerId: '',
    lines: [
      { productId: '', peso: '', presentacion: '' }
    ]
  })

  const fetchCatalogs = async () => {
  try {
    // clientes reales
    const cs = await fetchCustomers({ q: '', limit: 500 })
    setCustomers(Array.isArray(cs) ? cs : [])
    // productos puedes dejarlos igual que ya los cargas
    const pRes = await api.get('/api/catalog/products?limit=100').catch(() => ({ data: [] }))
    setProducts(Array.isArray(pRes.data) ? pRes.data : [])
  } catch {
    setCustomers([])
    setProducts([])
  }
}
  const load = async () => {
    setLoading(true)
    setMsg('')
    try {
      const data = await listOrders({
        q: q || undefined,
        state: state || undefined,
        from: from || undefined,
        to: to || undefined,
        limit: 50
      })
      setRows(data)
    } catch (e) {
      console.error(e)
      setMsg('Error cargando pedidos')
    }     finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCatalogs()
    // primer fetch
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSearch = (e) => {
    e.preventDefault()
    load()
  }

  // ====== crear pedido ======
  const addLine = () => {
    setForm(f => ({ ...f, lines: [...f.lines, { productId: '', peso: '', presentacion: '' }] }))
  }
  const removeLine = (idx) => {
    setForm(f => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }))
  }
  const setLine = (idx, patch) => {
    setForm(f => ({
      ...f,
      lines: f.lines.map((ln, i) => i === idx ? { ...ln, ...patch } : ln)
    }))
  }

  const canSubmit = useMemo(() => {
    if (!form.customerId) return false
    if (!Array.isArray(form.lines) || form.lines.length === 0) return false
    for (const l of form.lines) {
      if (!l.productId || Number(l.peso) <= 0 || Number(l.presentacion) <= 0) return false
    }
    return true
  }, [form])

  const submitCreate = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setCreating(true)
    setMsg('')
    try {
      const payload = {
        customerId: Number(form.customerId),
        lines: form.lines.map(l => ({
          productId: Number(l.productId),
          peso: Number(l.peso),
          presentacion: Number(l.presentacion)
        }))
      }
      await createOrderApi(payload)
      setShowCreate(false)
      // limpiar
      setForm({ customerId: '', lines: [{ productId: '', peso: '', presentacion: '' }] })
      await load()
      setMsg('✅ Pedido creado')
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error creando pedido')
    } finally {
      setCreating(false)
    }
  }

  return (
    <section className="card">
      <div className="topbar" style={{ marginBottom: 0 }}>
        <h3 style={{ margin: 0 }}>Pedidos</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {puedeCrear && (
            <button className="btn" onClick={() => setShowCreate(v => !v)}>
              {showCreate ? 'Cerrar' : 'Nuevo pedido'}
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <form onSubmit={onSearch} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, marginTop: 12 }}>
        <input placeholder="Buscar (cliente/RUC)" value={q} onChange={e => setQ(e.target.value)} />
        <select value={state} onChange={e => setState(e.target.value)}>
          <option value="">Estado</option>
          <option value="PENDIENTE">PENDIENTE</option>
          <option value="EN_PROCESO">EN_PROCESO</option>
          <option value="ENTREGADO">ENTREGADO</option>
          <option value="CANCELADO">CANCELADO</option>
        </select>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        <button className="btn-secondary" type="submit">Filtrar</button>
      </form>

      {msg && <div className="muted" style={{ marginTop: 8 }}>{msg}</div>}

      {/* Nuevo pedido (simple) */}
      {showCreate && puedeCrear && (
        <div className="card" style={{ marginTop: 14 }}>
          <h4 style={{ marginTop: 0 }}>Crear pedido</h4>
          <form onSubmit={submitCreate} style={{ display: 'grid', gap: 12 }}>
            <label>
              Cliente
              <select
                value={form.customerId}
                onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
                required
              >
                <option value="">— Selecciona —</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.razonSocial || c.RAZON_SOCIAL || `Cliente #${c.id}`}
                  </option>
                ))}
              </select>
            </label>

            <div className="muted">Líneas del pedido</div>
            {form.lines.map((ln, idx) => (
              <div key={idx} className="form-row">
                <label className="form-field">
                  <span>Producto</span>
                  <select value={ln.productId} onChange={e => setLine(idx, { productId: e.target.value })} required>
                    <option value="">—</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name || p.DESCRIPCION || `Producto #${p.id}`}</option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>Peso (kg)</span>
                  <input type="number" step="0.01" min="0.01" value={ln.peso} onChange={e => setLine(idx, { peso: e.target.value })} required />
                </label>
                <label className="form-field">
                  <span>Presentación</span>
                  <input type="number" step="1" min="1" value={ln.presentacion} onChange={e => setLine(idx, { presentacion: e.target.value })} required />
                </label>
                <div className="form-actions" style={{ gap: 8 }}>
                  {form.lines.length > 1 && (
                    <button type="button" className="btn-secondary" onClick={() => removeLine(idx)}>Quitar</button>
                  )}
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn-secondary" onClick={addLine}>+ Línea</button>
              <div style={{ flex: 1 }} />
              <button className="btn" disabled={!canSubmit || creating}>
                {creating ? 'Creando…' : 'Crear pedido'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabla */}
      <div className="table" style={{ marginTop: 14 }}>
        <div className="table__head">
          <div>Fecha</div>
          <div>Cliente</div>
          <div>Estado</div>
          <div>Acciones</div>
        </div>
        {!loading && rows.map(row => (
          <div className="table__row" key={row.id}>
            <div>{new Date(row.fecha).toLocaleString()}</div>
            <div>{row.customerName}</div>
            <div><span className="badge">{row.state}</span></div>
            <div>
              <Link className="btn-secondary" to={`/app/pedidos/${row.id}`}>Ver</Link>
            </div>
          </div>
        ))}
        {loading && <div className="muted">Cargando…</div>}
        {!loading && rows.length === 0 && <div className="muted">Sin resultados</div>}
      </div>
    </section>
  )
}
