// src/pages/EntregaDetalle.jsx
import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchOrder } from '../api/orders'
import { fetchDeliveriesByOrder } from '../api/deliveries'
import { hasRole, getUserFromToken } from '../utils/auth'
import CreateDeliveryModal from '../components/CreateDeliveryModal'

const fmtKg = n => (Number(n)||0).toFixed(2)
const fmtMoney = n => (Number(n)||0).toFixed(2)

export default function EntregaDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const me = getUserFromToken()
  const puedeEntregar =
    hasRole(me, 'PRODUCCION') || hasRole(me, 'JEFE') || hasRole(me, 'ADMINISTRADOR') || hasRole(me, 'ALMACENERO')

  const [order, setOrder] = useState(null)
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [openCreate, setOpenCreate] = useState(false)

  const load = async () => {
    setLoading(true); setMsg('')
    try {
      const [o, d] = await Promise.all([fetchOrder(id), fetchDeliveriesByOrder(id)])
      setOrder(o); setDeliveries(d)
    } catch (e) {
      console.error(e); setMsg('Error cargando pedido')
    } finally { setLoading(false) }
  }
  useEffect(()=>{ load() }, [id])

  // entregado por línea (para pendientes)
  const entregadoPorLinea = useMemo(() => {
    const map = new Map()
    for (const l of deliveries) {
      const k = Number(l.descriptionOrderId)
      const suma = Number(map.get(k) || 0) + Number(l.peso || 0)
      map.set(k, suma)
    }
    return map
  }, [deliveries])

  const lines = useMemo(() => {
    if (!order?.lines) return []
    return order.lines.map(l => {
      const entregado = Number(entregadoPorLinea.get(Number(l.id)) || 0)
      const pedido = Number(l.peso || l.pesoPedido || 0)
      const pendiente = Math.max(0, pedido - entregado)
      return { ...l, pedido, entregado, pendiente }
    })
  }, [order, entregadoPorLinea])

  const pedidoPesoTotal = useMemo(() => lines.reduce((a, l) => a + l.pedido, 0), [lines])
  const entregadoTotal  = useMemo(() => lines.reduce((a, l) => a + l.entregado, 0), [lines])
  const avanceCalc = pedidoPesoTotal ? Math.min(100, (entregadoTotal / pedidoPesoTotal) * 100) : 0

  // AGRUPAR entregas por deliveryId
  const deliveriesGrouped = useMemo(() => {
    const map = new Map()
    for (const r of deliveries) {
      const k = r.deliveryId
      if (!map.has(k)) map.set(k, { deliveryId: k, fecha: r.fecha, facturaId: r.facturaId, invoiceCode: r.invoiceCode, lines: [] })
      map.get(k).lines.push(r)
    }
    // ordenar por fecha desc
    return Array.from(map.values()).sort((a,b)=> new Date(b.fecha) - new Date(a.fecha))
  }, [deliveries])

  const badgeClass = (state) => {
    switch (state) {
      case 'PENDIENTE':  return 'badge badge--danger'
      case 'EN_PROCESO': return 'badge badge--warning'
      case 'ENTREGADO':  return 'badge badge--success'
      case 'CANCELADO':  return 'badge badge--dark'
      default:           return 'badge'
    }
  }

  if (loading) return <section className="card">Cargando…</section>
  if (!order)  return <section className="card">Pedido no encontrado</section>

  return (
    <section className="card">
      <div className="topbar" style={{ marginBottom:0 }}>
        <h3 style={{ margin:0 }}>Pedido #{order.id}</h3>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn-secondary" onClick={()=> navigate('/app/entregas/nueva')}>← Volver</button> 
          {puedeEntregar && order.state !== 'CANCELADO' && (
            <button className="btn" onClick={()=>setOpenCreate(true)}>Nueva entrega</button>
          )}
        </div>
      </div>

      <div className="muted" style={{ marginTop:6 }}>
        {order.customerName} · {new Date(order.fecha).toLocaleString()} · <span className={badgeClass(order.state)}>{order.state}</span>
      </div>

      <div className="progress" style={{ marginTop:16 }}>
        <div className="progress__label">Avance de entrega</div>
        <div className="progress__bar">
          <div className="progress__bar_fill" style={{ width: `${(order.avanceEntrega ?? avanceCalc).toFixed(2)}%` }} />
        </div>
        <div className="muted">
          Entregado: {fmtKg(entregadoTotal)} / {fmtKg(pedidoPesoTotal)} kg
        </div>
      </div>

      <h4 style={{ marginTop:16 }}>Líneas del pedido</h4>
      <div className="table">
        <div className="table__head" style={{ gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr' }}>
          <div>Producto</div>
          <div>Presentación</div>
          <div>Pedido</div>
          <div>Entregado</div>
          <div>Pendiente</div>
        </div>
        {lines.map(l => (
          <div key={l.id} className="table__row" style={{ gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr' }}>
            <div>{l.productName}</div>
            <div>{l.presentacion ?? '—'}</div>
            <div>{fmtKg(l.pedido)} kg</div>
            <div>{fmtKg(l.entregado)} kg</div>
            <div>{fmtKg(l.pendiente)} kg</div>
          </div>
        ))}
      </div>

      <h4 style={{ marginTop:16 }}>Entregas realizadas</h4>
      {deliveriesGrouped.length === 0 && <div className="muted">Sin entregas</div>}
      {deliveriesGrouped.map(grp => (
        <div key={grp.deliveryId} className="card" style={{ marginTop:8 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <b>Entrega #{grp.deliveryId}</b> · {new Date(grp.fecha).toLocaleString()}
            </div>
            <div className="muted">
              Factura: <b>{grp.invoiceCode ? grp.invoiceCode : '—'}</b>
            </div>
          </div>

          <div className="table" style={{ marginTop:10 }}>
            <div className="table__head">
              <div>Peso</div>
              <div>Precio</div>
              <div>Subtotal</div>
            </div>
            {grp.lines.map((d, idx) => (
              <div className="table__row" key={`${d.deliveryId}-${d.lineId}-${idx}`}>
                <div>{fmtKg(d.peso)} kg</div>
                <div>{d.unitPrice ? fmtMoney(d.unitPrice) : '0.00'} {d.currency || ''}</div>
                <div>{fmtMoney(d.subtotal)} {d.currency || ''}</div>
              </div>
            ))}
            <div className="table__row" style={{ fontWeight:700 }}>
              <div>Total</div>
              <div />
              <div>
                {fmtMoney(grp.lines.reduce((a,r)=>a+Number(r.subtotal||0),0))} {grp.lines[0]?.currency || ''}
              </div>
            </div>
          </div>
        </div>
      ))}

      {msg && <div style={{ marginTop:12 }}>{msg}</div>}

      <CreateDeliveryModal
        open={openCreate}
        onClose={()=>setOpenCreate(false)}
        order={{
          id: order.id,
          customerId: order.customerId,
          lines: lines.map(l => ({
            id: l.id,
            productId: l.productId,
            productName: l.productName,
            presentacion: l.presentacion ?? null,
            pendiente: l.pendiente
          }))
        }}
        onDone={async ()=>{ setOpenCreate(false); await load(); }}
      />
    </section>
  )
}
