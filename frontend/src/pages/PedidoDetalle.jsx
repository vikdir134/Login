import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchOrder } from '../api/orders'
import { fetchDeliveriesByOrder, createDelivery } from '../api/deliveries'
import { hasRole, getUserFromToken } from '../utils/auth'

export default function PedidoDetalle() {
  const { id } = useParams()
  const me = getUserFromToken()
  const puedeEntregar =
    hasRole(me, 'PRODUCCION') || hasRole(me, 'JEFE') || hasRole(me, 'ADMINISTRADOR')

  const [order, setOrder] = useState(null)
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [o, d] = await Promise.all([fetchOrder(id), fetchDeliveriesByOrder(id)])
      setOrder(o)
      setDeliveries(d)
    } catch {
      setMsg('Error cargando pedido')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  // === Entregado por línea (a partir de deliveries) ===
  const entregadoPorLinea = useMemo(() => {
    const map = new Map()
    for (const l of deliveries) {
      const k = Number(l.descriptionOrderId)
      const suma = Number(map.get(k) || 0) + Number(l.peso || 0)
      map.set(k, suma)
    }
    return map
  }, [deliveries])

  // === Enriquecer líneas con entregado y pendiente ===
  const lines = useMemo(() => {
    if (!order?.lines) return []
    return order.lines.map(l => {
      const entregado = Number(entregadoPorLinea.get(Number(l.id)) || 0)
      const pedido = Number(l.peso || l.pesoPedido || 0)
      const pendiente = Math.max(0, pedido - entregado)
      return { ...l, pedido, entregado, pendiente }
    })
  }, [order, entregadoPorLinea])

  const totalEntregado = useMemo(
    () => deliveries.reduce((acc, l) => acc + Number(l.peso || 0), 0),
    [deliveries]
  )

  // === Formulario de entrega ===
  const [lineId, setLineId] = useState(null)
  const [peso, setPeso] = useState('')
  const [desc, setDesc] = useState('')
  const [sending, setSending] = useState(false)

  // Por defecto, seleccionar la primera línea con pendiente > 0
  useEffect(() => {
    if (!lines.length) return
    const firstWithPending = lines.find(l => l.pendiente > 0)
    setLineId(firstWithPending ? firstWithPending.id : lines[0].id)
  }, [lines])

  const selectedLine = useMemo(
    () => lines.find(l => l.id === Number(lineId)),
    [lines, lineId]
  )

  const pesoNumber = Number(peso || 0)
  const excede = selectedLine ? pesoNumber > selectedLine.pendiente + 1e-9 : false
  const bloqueado = sending || !selectedLine || !pesoNumber || pesoNumber <= 0 || excede

  const onCreateDelivery = async (e) => {
    e.preventDefault()
    setMsg('')

    if (!selectedLine) { setMsg('Selecciona una línea válida'); return }
    if (!pesoNumber || pesoNumber <= 0) { setMsg('Ingresa un peso válido'); return }
    if (excede) { setMsg(`No puedes exceder lo pendiente. Restante: ${selectedLine.pendiente.toFixed(2)} kg`); return }

    setSending(true)
    try {
      // No enviamos fecha: el backend usa NOW()
      await createDelivery(id, {
        lines: [{ descriptionOrderId: selectedLine.id, peso: pesoNumber, descripcion: desc || null }]
      })
      setPeso('')
      setDesc('')
      await load()
      setMsg('✅ Entrega registrada')
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error creando entrega')
    } finally {
      setSending(false)
    }
  }

  if (loading) return <section className="card">Cargando…</section>
  if (!order) return <section className="card">Pedido no encontrado</section>

  return (
    <section className="card">
      <h3 style={{ marginTop:0 }}>Pedido #{order.id}</h3>
      <div className="muted">{order.customerName} · {new Date(order.fecha).toLocaleString()}</div>

      <div className="progress" style={{ marginTop:16 }}>
        <div className="progress__label">Avance de entrega</div>
        <div className="progress__bar">
          <div className="progress__bar_fill" style={{ width: `${order.avanceEntrega ?? 0}%` }} />
        </div>
        <div className="muted">
          Entregado: {order.entregadoPeso?.toFixed ? order.entregadoPeso.toFixed(2) : totalEntregado.toFixed(2)} / {order.pedidoPeso?.toFixed ? order.pedidoPeso.toFixed(2) : '—'} kg
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
          <h4 style={{ marginTop:16 }}>Registrar entrega</h4>

          <form onSubmit={onCreateDelivery} className="form-row">
            <label className="form-field">
              <span>Línea de pedido</span>
              <select value={lineId ?? ''} onChange={e => setLineId(Number(e.target.value))}>
                {lines.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.productName} — Pendiente: {l.pendiente.toFixed(2)} kg
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Peso (kg)</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={peso}
                onChange={e => setPeso(e.target.value)}
                placeholder="0.00"
              />
            </label>

            <label className="form-field">
              <span>Descripción (opcional)</span>
              <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Nota de entrega" />
            </label>

            <div className="form-actions">
              <button className="btn" disabled={bloqueado}>
                {sending ? 'Guardando…' : 'Entregar'}
              </button>
            </div>
          </form>

          {selectedLine && (
            <div className="muted" style={{ marginTop:8 }}>
              Pendiente de la línea seleccionada: <strong>{selectedLine.pendiente.toFixed(2)} kg</strong>
            </div>
          )}
          {excede && (
            <div className="error" style={{ marginTop:8 }}>
              No puedes exceder lo pendiente ({selectedLine.pendiente.toFixed(2)} kg).
            </div>
          )}
        </>
      )}

      {msg && <div style={{ marginTop:12 }}>{msg}</div>}
    </section>
  )
}
