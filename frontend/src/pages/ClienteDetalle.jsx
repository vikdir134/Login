import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchCustomerDetail } from '../api/customers'   // <- ojo aquí
// Si quieres listar pedidos del cliente por separado, puedes usar listOrders({ customerId: id })
// pero como el endpoint ya devuelve los pedidos, no es necesario.

function safeFixed(n, d = 2) {
  const num = Number(n)
  return Number.isFinite(num) ? num.toFixed(d) : (0).toFixed(d)
}

export default function ClienteDetalle() {
  const { id } = useParams()

  const [customer, setCustomer] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    setMsg('')

    fetchCustomerDetail(id)
      .then(({ customer, orders }) => {
        if (!alive) return
        setCustomer(customer || null)
        setOrders(Array.isArray(orders) ? orders : [])
      })
      .catch(() => alive && setMsg('Error cargando datos de cliente'))
      .finally(() => alive && setLoading(false))

    return () => { alive = false }
  }, [id])

  if (loading) return <section className="card">Cargando…</section>
  if (!customer) return <section className="card">Cliente no encontrado</section>

  return (
    <section className="card">
      <header style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h3 style={{ margin:0 }}>{customer.razonSocial}</h3>
          <div className="muted">
            RUC: {customer.RUC} · {customer.activo ? 'Activo' : 'Inactivo'} ·
            {' '}Creado: {customer.createdAt ? new Date(customer.createdAt).toLocaleString() : '—'}
          </div>
        </div>
        <Link className="btn-secondary" to="/app/clientes">← Volver</Link>
      </header>

      {/* Stats simples (placeholder por ahora) */}
      <div className="grid-3" style={{ marginTop:16 }}>
        <div className="stat">
          <div className="stat__label">Pedidos totales</div>
          <div className="stat__value">{orders.length}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Pedidos abiertos</div>
          <div className="stat__value">{orders.filter(o => o.state !== 'ENTREGADO' && o.state !== 'CANCELADO').length}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Pagado (S/)</div>
          <div className="stat__value">{safeFixed(0)}</div>
        </div>
      </div>

      <h4 style={{ marginTop:24 }}>Pedidos</h4>
      <div className="table">
        <div className="table__head">
          <div>Fecha</div>
          <div>Estado</div>
          <div>Acciones</div>
        </div>
        {orders.map(o => (
          <div className="table__row" key={o.id}>
            <div>{o.fecha ? new Date(o.fecha).toLocaleString() : '—'}</div>
            <div><span className="badge">{o.state}</span></div>{/* <- state, no estado */}
            <div><Link className="btn-secondary" to={`/app/pedidos/${o.id}`}>Abrir</Link></div>
          </div>
        ))}
        {orders.length === 0 && <div className="muted">Sin pedidos</div>}
      </div>

      {msg && <div className="error" style={{ marginTop:8 }}>{msg}</div>}
    </section>
  )
}
