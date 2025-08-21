// src/pages/PedidoDetalle.jsx
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchOrder } from '../api/orders'
import { fetchDeliveriesByOrder, createDelivery } from '../api/deliveries'
import { hasRole, getUserFromToken } from '../utils/auth'
import DeliveryModal from '../components/DeliveryModal'

export default function PedidoDetalle() {
  const { id } = useParams()
  const me = getUserFromToken()
  const puedeEntregar =
    hasRole(me, 'PRODUCCION') || hasRole(me, 'JEFE') || hasRole(me, 'ADMINISTRADOR')

  const [order, setOrder] = useState(null)
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  // Carga pedido + entregas
  const load = async () => {
    setLoading(true)
    setMsg('')
    try {
      const [o, d] = await Promise.all([fetchOrder(id), fetchDeliveriesByOrder(id)])
      setOrder(o)
      setDeliveries(d)
    } catch (e) {
      console.error(e)
      setMsg('Error cargando pedido')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [id])

  // Mapa: entregado por línea
  const entregadoPorLinea = useMemo(() => {
    const map = new Map()
    for (const l of deliveries) {
      const k = Number(l.descriptionOrderId)
      const suma = Number(map.get(k) || 0) + Number(l.peso || 0)
      map.set(k, suma)
    }
    return map
  }, [deliveries])

  // Enriquecer líneas con pedido/entregado/pendiente
  const lines = useMemo(() => {
    if (!order?.lines) return []
    return order.lines.map(l => {
      const entregado = Number(entregadoPorLinea.get(Number(l.id)) || 0)
      const pedido = Number(l.peso || l.pesoPedido || 0)
      const pendiente = Math.max(0, pedido - entregado)
      return { ...l, pedido, entregado, pendiente }
    })
  }, [order, entregadoPorLinea])

  // Totales (fallback si el backend no manda agregados)
  const pedidoPesoTotal = useMemo(() => lines.reduce((a, l) => a + l.pedido, 0), [lines])
  const entregadoTotal  = useMemo(() => lines.reduce((a, l) => a + l.entregado, 0), [lines])
  const avanceCalc = pedidoPesoTotal ? Math.min(100, (entregadoTotal / pedidoPesoTotal) * 100) : 0

  // Modal “Nueva entrega”
  const [openModal, setOpenModal] = useState(false)
  const handleSubmitDelivery = async ({ descriptionOrderId, peso, facturaId, descripcion }) => {
    setMsg('')
    try {
      await createDelivery(id, {
        facturaId: facturaId ?? null,
        // No enviamos fecha: backend usa NOW()
        lines: [{ descriptionOrderId, peso, descripcion }]
      })
      setOpenModal(false)
      await load()
      setMsg('✅ Entrega registrada')
    } catch (err) {
      console.error(err)
      setMsg(err.response?.data?.error || 'Error creando entrega')
    }
  }

  if (loading) return <section className="card">Cargando…</section>
  if (!order)  return <section className="card">Pedido no encontrado</section>

  return (
    <section className="card">
      <h3 style={{ marginTop:0 }}>Pedido #{order.id}</h3>
      <div className="muted">
        {order.customerName} · {new Date(order.fecha).toLocaleString()}
      </div>

      <div className="progress" style={{ marginTop:16 }}>
        <div className="progress__label">Avance de entrega</div>
        <div className="progress__bar">
          <div
            className="progress__bar_fill"
            style={{ width: `${(order.avanceEntrega ?? avanceCalc).toFixed(2)}%` }}
          />
        </div>
        <div className="muted">
          Entregado: {entregadoTotal.toFixed(2)} / {pedidoPesoTotal.toFixed(2)} kg
        </div>
      </div>

      <h4 style={{ marginTop:16 }}>Líneas del pedido</h4>
      <div className="table">
        <div className="table__head">
          <div>Producto</div>
          <div>Pedido</div>
          <div>Entregado</div>
          <div>Pendiente</div>
        </div>
        {lines.map(l => (
          <div key={l.id} className="table__row">
            <div>{l.productName}</div>
            <div>{l.pedido.toFixed(2)} kg</div>
            <div>{l.entregado.toFixed(2)} kg</div>
            <div>{l.pendiente.toFixed(2)} kg</div>
          </div>
        ))}
      </div>

      <h4 style={{ marginTop:16 }}>Entregas realizadas</h4>
      <div className="table">
        <div className="table__head">
          <div>Fecha</div>
          <div>Peso</div>
          <div>Precio</div>
          <div>Subtotal</div>
        </div>
        {deliveries.map((d, idx) => (
          <div className="table__row" key={`${d.deliveryId}-${d.lineId}-${idx}`}>
            <div>{new Date(d.fecha).toLocaleString()}</div>
            <div>{Number(d.peso).toFixed(2)} kg</div>
            <div>{d.unitPrice ? Number(d.unitPrice).toFixed(2) : '—'} {d.currency || ''}</div>
            <div>{Number(d.subtotal).toFixed(2)} {d.currency || ''}</div>
          </div>
        ))}
        {deliveries.length === 0 && <div className="muted">Sin entregas</div>}
      </div>

      {puedeEntregar && (
        <>
          <div style={{ marginTop:16 }}>
            <button className="btn" onClick={()=>setOpenModal(true)}>+ Nueva entrega</button>
          </div>

          <DeliveryModal
            open={openModal}
            onClose={()=>setOpenModal(false)}
            lines={lines}                 // [{ id, productName, pedido, entregado, pendiente }]
            onSubmit={handleSubmitDelivery}
          />
        </>
      )}

      {msg && <div style={{ marginTop:12 }}>{msg}</div>}
    </section>
  )
}
