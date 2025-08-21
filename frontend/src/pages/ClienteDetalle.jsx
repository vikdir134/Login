import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchCustomerSummary } from '../api/customers'
import { listOrders } from '../api/orders'
import { hasRole, getUserFromToken } from '../utils/auth'

export default function ClienteDetalle() {
  const { id } = useParams()
  const me = getUserFromToken()
  const puedeCrearPedido = hasRole(me, 'PRODUCCION') || hasRole(me, 'JEFE') || hasRole(me, 'ADMINISTRADOR')

  const [info, setInfo] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([
      fetchCustomerSummary(id),
      listOrders({ customerId: id, limit: 10 }) // ← últimos 10
    ])
      .then(([i, os]) => { if (alive) { setInfo(i); setOrders(os) } })
      .catch(() => { if (alive) setMsg('Error cargando datos de cliente') })
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [id])

  if (loading) return <section className="card">Cargando…</section>
  if (!info) return <section className="card">Cliente no encontrado</section>

  return (
    <section className="card">
      <header style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h3 style={{ margin:0 }}>{info.razonSocial}</h3>
          <div className="muted">RUC: {info.RUC} · {info.activo ? 'Activo' : 'Inactivo'}</div>
        </div>
        {puedeCrearPedido && (
          <Link className="btn" to={`/app/pedidos/nuevo?customerId=${info.id}`}>+ Nuevo pedido</Link>
        )}
      </header>

      {/* KPIs resumidos si los tienes */}
      {/* ... */}

      <h4 style={{ marginTop:24 }}>Pedidos (últimos 10)</h4>
      <div className="table">
        <div className="table__head">
          <div>Fecha</div>
          <div>Estado</div>
          <div>Acciones</div>
        </div>
        {orders.map(o => (
          <div className="table__row" key={o.id}>
            <div>{new Date(o.fecha).toLocaleString()}</div>
            <div>{o.estado || o.state}</div>
            <div>
              {/* Ir al detalle del pedido (items / descripción) */}
              <Link className="btn-secondary" to={`/app/pedidos/${o.id}`}>Abrir</Link>
            </div>
          </div>
        ))}
        {orders.length === 0 && <div className="muted">Sin pedidos</div>}
      </div>

      {msg && <div className="muted" style={{ marginTop:8 }}>{msg}</div>}
    </section>
  )
}
