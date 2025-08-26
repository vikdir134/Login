// src/pages/EntregaDetalle.jsx
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchOrder } from '../api/orders'
import { fetchDeliveriesByOrder, createDelivery } from '../api/deliveries'
import { hasRole, getUserFromToken } from '../utils/auth'
import { getEffectivePrice } from '../api/prices'
import CreateDeliveryModal from '../components/CreateDeliveryModal' // <-- NUEVO

const fmtKg = n => (Number(n)||0).toFixed(2)
const fmtMoney = n => (Number(n)||0).toFixed(2)

export default function EntregaDetalle() {
  const { id } = useParams()
  const me = getUserFromToken()
  const puedeEntregar =
    hasRole(me, 'PRODUCCION') || hasRole(me, 'JEFE') || hasRole(me, 'ADMINISTRADOR') || hasRole(me, 'ALMACENERO')

  const [order, setOrder] = useState(null)
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  // modal multi-línea
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

  // entregado por línea
  const entregadoPorLinea = useMemo(() => {
    const map = new Map()
    for (const l of deliveries) {
      const k = Number(l.descriptionOrderId)
      const suma = Number(map.get(k) || 0) + Number(l.peso || 0)
      map.set(k, suma)
    }
    return map
  }, [deliveries])

  // líneas enriquecidas
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

  // === Form (modo 1: tu formulario actual de UNA sola línea) ===
  const productos = useMemo(() => {
    const m = new Map()
    for (const l of lines) {
      if (!m.has(l.productId)) m.set(l.productId, l.productName)
    }
    return Array.from(m, ([id, name]) => ({ id, name }))
  }, [lines])

  const [selectedProductId, setSelectedProductId] = useState('')
  const lineasDelProducto = useMemo(() => {
    const pid = Number(selectedProductId)
    return lines.filter(l => l.productId === pid)
  }, [lines, selectedProductId])

  const [selectedLineId, setSelectedLineId] = useState('')
  const [peso, setPeso] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [currency, setCurrency] = useState('PEN')
  const [descripcion, setDescripcion] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setSelectedLineId('')
    setPeso('')
    setDescripcion('')
    setUnitPrice('')
    if (!order?.customerId || !selectedProductId) return
    ;(async ()=>{
      const { price, currency } = await getEffectivePrice({
        customerId: order.customerId,
        productId: Number(selectedProductId)
      })
      setUnitPrice(String(price ?? 0))
      setCurrency(currency || 'PEN')
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId])

  const selectedLine = useMemo(
    () => lineasDelProducto.find(l => String(l.id) === String(selectedLineId)) || null,
    [lineasDelProducto, selectedLineId]
  )

  const subtotal = useMemo(() => (Number(peso)||0) * (Number(unitPrice)||0), [peso, unitPrice])

  const canSubmit = useMemo(() => {
    if (!puedeEntregar) return false
    if (!selectedProductId || !selectedLineId) return false
    if (Number(peso) <= 0) return false
    if (selectedLine && Number(peso) > Number(selectedLine.pendiente || 0)) return false
    if (unitPrice === '' || isNaN(Number(unitPrice))) return false
    return true
  }, [puedeEntregar, selectedProductId, selectedLineId, peso, unitPrice, selectedLine])

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true); setMsg('')
    try {
      await createDelivery(id, {
        facturaId: null,
        lines: [{
          descriptionOrderId: Number(selectedLineId),
          peso: Number(peso),
          descripcion: descripcion || null,
          unitPrice: Number(unitPrice),
          currency: currency || 'PEN'
        }]
      })
      setPeso(''); setDescripcion('')
      await load()
      setMsg('✅ Entrega registrada')
    } catch (err) {
      console.error('AXIOS ERROR:', err)
      console.error('SERVER ERROR BODY:', err?.response?.data)
      const server = err?.response?.data
      setMsg(server?.error || server?.message || 'Error creando entrega')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <section className="card">Cargando…</section>
  if (!order)  return <section className="card">Pedido no encontrado</section>

  const badgeClass = (state) => {
    switch (state) {
      case 'PENDIENTE':  return 'badge badge--danger'
      case 'EN_PROCESO': return 'badge badge--warning'
      case 'ENTREGADO':  return 'badge badge--success'
      case 'CANCELADO':  return 'badge badge--dark'
      default:           return 'badge'
    }
  }

  return (
    <section className="card">
      <h3 style={{ marginTop:0 }}>Pedido #{order.id}</h3>
      <div className="muted">
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

      {puedeEntregar && order.state !== 'CANCELADO' && (
        <>
          {/* MODO 2: Botón para abrir modal multi-línea */}
          <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:16 }}>
            <button className="btn-secondary" onClick={()=>setOpenCreate(true)}>Nueva entrega </button>
          </div>
        </>
      )}

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
            <div>{fmtKg(d.peso)} kg</div>
            <div>{d.unitPrice ? fmtMoney(d.unitPrice) : '0.00'} {d.currency || ''}</div>
            <div>{fmtMoney(d.subtotal)} {d.currency || ''}</div>
          </div>
        ))}
        {deliveries.length === 0 && <div className="muted">Sin entregas</div>}
      </div>

      {msg && <div style={{ marginTop:12 }}>{msg}</div>}

      {/* MODAL multi-línea */}
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
