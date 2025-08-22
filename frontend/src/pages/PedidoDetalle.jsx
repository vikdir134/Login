// src/pages/PedidoDetalle.jsx
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchOrder } from '../api/orders'
import {
  addOrderLine,
  updateOrderLine,
  deleteOrderLine,
  cancelOrder,
  reactivateOrder
} from '../api/orders'
import { fetchDeliveriesByOrder, createDelivery } from '../api/deliveries'
import { hasRole, getUserFromToken } from '../utils/auth'
import DeliveryModal from '../components/DeliveryModal'
import api from '../api/axios'

const badgeClass = (state) => {
  switch (String(state || '').toUpperCase()) {
    case 'PENDIENTE':   return 'badge badge--danger'
    case 'EN_PROCESO':  return 'badge badge--warning'
    case 'ENTREGADO':   return 'badge badge--success'
    case 'CANCELADO':   return 'badge badge--dark'
    default:            return 'badge'
  }
}

export default function PedidoDetalle() {
  const { id } = useParams()
  const me = getUserFromToken()
  const puedeEntregar = hasRole(me,'PRODUCCION') || hasRole(me,'JEFE') || hasRole(me,'ADMINISTRADOR')
  const puedeEditar   = hasRole(me,'PRODUCCION') || hasRole(me,'JEFE') || hasRole(me,'ADMINISTRADOR')
  const puedeEstado   = hasRole(me,'JEFE') || hasRole(me,'ADMINISTRADOR')

  const [order, setOrder] = useState(null)
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)

  // cat. productos para agregar línea
  const [products, setProducts] = useState([])

  // UI: agregar línea
  const [newLine, setNewLine] = useState({ productId:'', peso:'', presentacion:'' })
  const canAddLine = newLine.productId && Number(newLine.peso)>0 && Number(newLine.presentacion)>0

  // UI: edición en línea
  const [editLineId, setEditLineId] = useState(null)
  const [editForm, setEditForm] = useState({ peso:'', presentacion:'' })

  // Modal entrega
  const [openModal, setOpenModal] = useState(false)

  // Modal de confirmación (Cancelar pedido)
  const [askCancel, setAskCancel] = useState(false)

  // Toast (notificación web in-app)
  const [toast, setToast] = useState(null) // { type:'success'|'error'|'info', text:string }
  const showToast = (type, text) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 3000)
  }

  const load = async () => {
    setLoading(true)
    try {
      const [o, d, p] = await Promise.all([
        fetchOrder(id),
        fetchDeliveriesByOrder(id),
        api.get('/api/catalog/products?limit=1000').then(r => r.data).catch(()=>[])
      ])
      setOrder(o)
      setDeliveries(d)
      setProducts(Array.isArray(p) ? p : [])
    } catch (e) {
      console.error(e)
      showToast('error', 'Error cargando pedido')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [id])

  // entregado por línea
  const entregadoPorLinea = useMemo(() => {
    const map = new Map()
    for (const l of deliveries) {
      const k = Number(l.descriptionOrderId)
      map.set(k, Number(map.get(k) || 0) + Number(l.peso || 0))
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

  const totals = useMemo(() => {
    const pedido = lines.reduce((a,l)=>a + l.pedido, 0)
    const entregado = lines.reduce((a,l)=>a + l.entregado, 0)
    const avance = pedido ? Math.min(100, (entregado/pedido)*100) : 0
    return { pedido, entregado, avance }
  }, [lines])

  // ====== acciones líneas ======
  const submitAddLine = async (e) => {
    e.preventDefault()
    if (!canAddLine) return
    try {
      await addOrderLine(Number(id), {
        productId: Number(newLine.productId),
        peso: Number(newLine.peso),
        presentacion: Number(newLine.presentacion)
      })
      setNewLine({ productId:'', peso:'', presentacion:'' })
      await load()
      showToast('success', 'Línea agregada')
    } catch (err) {
      console.error(err)
      showToast('error', err.response?.data?.error || 'Error agregando línea')
    }
  }

  const startEdit = (l) => {
    setEditLineId(l.id)
    setEditForm({ peso: l.pedido, presentacion: l.presentacion })
  }
  const cancelEdit = () => {
    setEditLineId(null)
    setEditForm({ peso:'', presentacion:'' })
  }
  const submitEdit = async (lineId) => {
    try {
      await updateOrderLine(Number(id), Number(lineId), {
        peso: Number(editForm.peso),
        presentacion: Number(editForm.presentacion)
      })
      cancelEdit()
      await load()
      showToast('success', 'Línea actualizada')
    } catch (err) {
      console.error(err)
      showToast('error', err.response?.data?.error || 'Error actualizando línea')
    }
  }
  const removeLine = async (lineId) => {
    // puedes cambiar esto a un modal también si quieres
    if (!window.confirm('¿Eliminar esta línea?')) return
    try {
      await deleteOrderLine(Number(id), Number(lineId))
      await load()
      showToast('success', 'Línea eliminada')
    } catch (err) {
      console.error(err)
      showToast('error', err.response?.data?.error || 'No se pudo eliminar la línea')
    }
  }

  // ====== estado ======
  const onCancelConfirmed = async () => {
    try {
      await cancelOrder(Number(id))
      setAskCancel(false)
      await load()
      showToast('success', 'Pedido cancelado')
    } catch (err) {
      console.error(err)
      showToast('error', err.response?.data?.error || 'Error cancelando pedido')
    }
  }
  const onReactivate = async () => {
    try {
      await reactivateOrder(Number(id))
      await load()
      showToast('success', 'Pedido reactivado')
    } catch (err) {
      console.error(err)
      showToast('error', err.response?.data?.error || 'Error reactivando pedido')
    }
  }
  const onRefreshState = async () => {
  try {
    if (String(order.state).toUpperCase() === 'CANCELADO') {
      await reactivateOrder(Number(id))
    } else {
      await cancelOrder(Number(id))
      await reactivateOrder(Number(id))
    }
    await load()
    showToast('success', 'Estado recalculado según entregas y líneas')
  } catch (err) {
    console.error(err)
    showToast('error', err.response?.data?.error || 'No se pudo recalcular el estado')
  }
}

  // ====== entregas ======
  const handleSubmitDelivery = async ({ descriptionOrderId, peso, facturaId, descripcion }) => {
    try {
      await createDelivery(id, {
        facturaId: facturaId ?? null,
        lines: [{ descriptionOrderId, peso, descripcion }]
      })
      setOpenModal(false)
      await load()
      showToast('success', 'Entrega registrada')
    } catch (err) {
      console.error(err)
      showToast('error', err.response?.data?.error || 'Error creando entrega')
    }
  }

  if (loading) return <section className="card">Cargando…</section>
  if (!order)  return <section className="card">Pedido no encontrado</section>

  const isCancelado = String(order.state).toUpperCase() === 'CANCELADO'

  return (
    <section className="card" style={{ position:'relative' }}>
      {/* Toast (notificación in-app) */}
      {toast && (
        <div
          className={`toast ${toast.type}`}
          style={{
            position:'fixed', right:16, bottom:16, zIndex:1000,
            background: toast.type==='success' ? '#e6ffed' : toast.type==='error' ? '#ffe6e6' : '#eef',
            color:'#000', border:'1px solid rgba(0,0,0,.1)', padding:'10px 14px', borderRadius:10,
            boxShadow:'0 4px 18px rgba(0,0,0,.12)'
          }}
        >
          {toast.text}
        </div>
      )}

        <div className="topbar">
          <h3 style={{ margin:0 }}>Pedido #{order.id}</h3>
          <div className={badgeClass(order.state)}>{order.state}</div>
          <div style={{ flex:1 }} />
          {puedeEstado && (
            <>
              {/* Recalcular/actualizar estado siempre visible para roles permitidos */}
              <button className="btn-secondary" onClick={onRefreshState}>Actualizar estado</button>

              {!isCancelado && (
                <button className="btn-secondary" onClick={()=>setAskCancel(true)}>Cancelar pedido</button>
              )}
              {isCancelado && (
                <button className="btn" onClick={onReactivate}>Reactivar</button>
              )}
            </>
          )}
        </div>

      <div className="muted">
        {order.customerName} · {new Date(order.fecha).toLocaleString()}
      </div>

      <div className="progress" style={{ marginTop:16 }}>
        <div className="progress__label">Avance de entrega</div>
        <div className="progress__bar">
          <div className="progress__bar_fill" style={{ width: `${(order.avanceEntrega ?? totals.avance).toFixed(2)}%` }} />
        </div>
        <div className="muted">
          Entregado: {totals.entregado.toFixed(2)} / {totals.pedido.toFixed(2)} kg
        </div>
      </div>

      <h4 style={{ marginTop:16 }}>Líneas del pedido</h4>
      <div className="table">
        {/* Agregamos la columna Presentación */}
        <div className="table__head" style={{ gridTemplateColumns:'2fr .8fr .8fr .8fr .8fr auto' }}>
          <div>Producto</div>
          <div>Presentación</div>
          <div>Pedido</div>
          <div>Entregado</div>
          <div>Pendiente</div>
          <div>Acciones</div>
        </div>
        {lines.map(l => (
          <div className="table__row" key={l.id} style={{ gridTemplateColumns:'2fr .8fr .8fr .8fr .8fr auto' }}>
            <div>{l.productName}</div>

            {editLineId === l.id ? (
              <>
                <div>
                  <input type="number" step="1" min="1" value={editForm.presentacion}
                    onChange={e=>setEditForm(f=>({ ...f, presentacion: e.target.value }))}/>
                </div>
                <div>
                  <input type="number" step="0.01" min={l.entregado} value={editForm.peso}
                    onChange={e=>setEditForm(f=>({ ...f, peso: e.target.value }))}/>
                </div>
                <div>{l.entregado.toFixed(2)} kg</div>
                <div>{Math.max(0, Number(editForm.peso||0)-l.entregado).toFixed(2)} kg</div>
                <div style={{ display:'flex', gap:6 }}>
                  <button className="btn" onClick={()=>submitEdit(l.id)}>Guardar</button>
                  <button className="btn-secondary" onClick={cancelEdit}>Cancelar</button>
                </div>
              </>
            ) : (
              <>
                <div>{Number(l.presentacion || 0).toFixed(0)}</div>
                <div>{l.pedido.toFixed(2)} kg</div>
                <div>{l.entregado.toFixed(2)} kg</div>
                <div>{l.pendiente.toFixed(2)} kg</div>
                <div style={{ display:'flex', gap:6 }}>
                  {puedeEditar && !isCancelado && (
                    <>
                      <button className="btn-secondary" onClick={()=>startEdit(l)}>Editar</button>
                      <button className="btn-secondary" disabled={l.entregado>0} onClick={()=>removeLine(l.id)}>Eliminar</button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
        {lines.length === 0 && <div className="muted">Sin líneas</div>}
      </div>

      {puedeEditar && !isCancelado && (
        <div className="card" style={{ marginTop:14 }}>
          <h4 style={{ marginTop:0 }}>Agregar línea</h4>
          <form onSubmit={submitAddLine} className="form-row">
            <label className="form-field">
              <span>Producto</span>
              <select value={newLine.productId} onChange={e=>setNewLine(v=>({ ...v, productId: e.target.value }))} required>
                <option value="">—</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name || p.DESCRIPCION || `Producto #${p.id}`}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Peso (kg)</span>
              <input type="number" step="0.01" min="0.01" value={newLine.peso}
                     onChange={e=>setNewLine(v=>({ ...v, peso: e.target.value }))} required/>
            </label>
            <label className="form-field">
              <span>Presentación</span>
              <input type="number" step="1" min="1" value={newLine.presentacion}
                     onChange={e=>setNewLine(v=>({ ...v, presentacion: e.target.value }))} required/>
            </label>
            <div className="form-actions">
              <button className="btn" disabled={!canAddLine}>Agregar</button>
            </div>
          </form>
        </div>
      )}

      <h4 style={{ marginTop:16 }}>Entregas realizadas</h4>
      <div className="table">
        <div className="table__head" style={{ gridTemplateColumns:'1fr 1fr 1fr 1fr' }}>
          <div>Fecha</div>
          <div>Peso</div>
          <div>Precio</div>
          <div>Subtotal</div>
        </div>
        {deliveries.map((d, idx) => (
          <div className="table__row" key={`${d.deliveryId}-${d.lineId}-${idx}`} style={{ gridTemplateColumns:'1fr 1fr 1fr 1fr' }}>
            <div>{new Date(d.fecha).toLocaleString()}</div>
            <div>{Number(d.peso).toFixed(2)} kg</div>
            <div>{d.unitPrice ? Number(d.unitPrice).toFixed(2) : '—'} {d.currency || ''}</div>
            <div>{Number(d.subtotal).toFixed(2)} {d.currency || ''}</div>
          </div>
        ))}
        {deliveries.length === 0 && <div className="muted">Sin entregas</div>}
      </div>

      {puedeEntregar && !isCancelado && (
        <>
          <div style={{ marginTop:16 }}>
            <button className="btn" onClick={()=>setOpenModal(true)}>+ Nueva entrega</button>
          </div>
          <DeliveryModal
            open={openModal}
            onClose={()=>setOpenModal(false)}
            lines={lines} // [{ id, productName, pedido, entregado, pendiente }]
            onSubmit={handleSubmitDelivery}
          />
        </>
      )}

      {/* Modal confirmación cancelar pedido */}
      {askCancel && (
        <div className="modal modal--center">
          <div className="modal__card">
            <div className="modal__header">
              <h4 style={{ margin:0 }}>Cancelar pedido</h4>
              <button className="btn-secondary" onClick={()=>setAskCancel(false)}>Cerrar</button>
            </div>
            <div className="muted" style={{ margin:'8px 0 16px' }}>
              ¿Seguro que deseas cancelar este pedido? Podrás reactivarlo luego.
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="btn-secondary" onClick={()=>setAskCancel(false)}>Volver</button>
              <button className="btn" onClick={onCancelConfirmed}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
