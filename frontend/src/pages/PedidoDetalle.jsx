// src/pages/PedidoDetalle.jsx
import { useEffect, useMemo, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchOrder } from '../api/orders'
import {
  addOrderLine,
  updateOrderLine,
  deleteOrderLine,
  cancelOrder,
  reactivateOrder
} from '../api/orders'
import { fetchDeliveriesByOrder } from '../api/deliveries'
import { hasRole, getUserFromToken } from '../utils/auth'
import api from '../api/axios'

/** === Config === */
const IGV = 0.18

/** === Utils UI === */
const badgeClass = (state) => {
  switch (String(state || '').toUpperCase()) {
    case 'PENDIENTE':   return 'badge badge--danger'
    case 'EN_PROCESO':  return 'badge badge--warning'
    case 'ENTREGADO':   return 'badge badge--success'
    case 'CANCELADO':   return 'badge badge--dark'
    default:            return 'badge'
  }
}
const fmtKg = n => (Number(n) || 0).toFixed(2)
const fmtMoney = n => (Number(n) || 0).toFixed(2)

/** === helpers búsqueda === */
const normalize = (s='') =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase()
function filterStartsThenIncludes(options, query, getLabel){
  const q = normalize(query)
  if (!q) return []
  const starts = []
  const includes = []
  for (const opt of options){
    const l = normalize(getLabel(opt))
    if (l.startsWith(q)) starts.push(opt)
    else if (l.includes(q)) includes.push(opt)
  }
  return [...starts, ...includes]
}

/** === Autocomplete ligero (sin libs) === */
function Autocomplete({
  label,
  value,            // id actual (string|number|null)
  display,          // texto mostrado
  onChange,         // (id, obj) => void
  options,          // array de objetos
  getLabel,         // (opt) => string
  getKey,           // (opt) => id
  placeholder = 'Escribe para buscar…'
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(display || '')
  const [hoverIdx, setHoverIdx] = useState(-1)
  const boxRef = useRef(null)

  useEffect(()=>{
    const onDoc = (e)=>{
      if (!boxRef.current) return
      if (!boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return ()=> document.removeEventListener('mousedown', onDoc)
  },[])

  const results = useMemo(()=>{
    if (!query) return []
    return filterStartsThenIncludes(options, query, getLabel).slice(0, 20)
  },[options, query, getLabel])

  useEffect(()=>{ setQuery(display || '') }, [display])

  const choose = (opt) => {
    const id = getKey(opt)
    const text = getLabel(opt)
    onChange(id, opt)
    setQuery(text)
    setOpen(false)
  }

  const onKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { setOpen(true); return }
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHoverIdx(i => Math.min(results.length-1, i+1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHoverIdx(i => Math.max(0, i-1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = results[hoverIdx] ?? results[0]
      if (opt) choose(opt)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <label className="form-field" ref={boxRef} style={{ position:'relative' }}>
      {label && <span>{label}</span>}
      <input
        value={query}
        onChange={e=>{ setQuery(e.target.value); setOpen(true) }}
        onFocus={()=> setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <div
          className="card"
          style={{
            position:'absolute', left:0, right:0, top:'100%', zIndex:20,
            marginTop:4, maxHeight:280, overflow:'auto', padding:6
          }}
        >
          {results.map((opt, idx)=>(
            <div
              key={getKey(opt)}
              onMouseEnter={()=>setHoverIdx(idx)}
              onMouseDown={(e)=> e.preventDefault()}
              onClick={()=>choose(opt)}
              style={{
                padding:'8px 10px', borderRadius:10,
                background: idx===hoverIdx ? 'rgba(0,0,0,0.05)' : 'transparent',
                cursor:'pointer'
              }}
            >
              {getLabel(opt)}
            </div>
          ))}
        </div>
      )}
    </label>
  )
}

export default function PedidoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
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
  const [newLine, setNewLine] = useState({ productId:'', productLabel:'', peso:'', presentacion:'' })
  const canAddLine = newLine.productId && Number(newLine.peso)>0 && Number(newLine.presentacion)>0

  // UI: edición en línea
  const [editLineId, setEditLineId] = useState(null)
  const [editForm, setEditForm] = useState({ peso:'', presentacion:'' })

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
      setDeliveries(Array.isArray(d) ? d : [])
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
      setNewLine({ productId:'', productLabel:'', peso:'', presentacion:'' })
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

  // ====== agrupación de entregas por entrega (deliveryId/fecha) ======
  const grouped = useMemo(() => {
    const map = new Map()
    for (const d of deliveries) {
      const k = String(d.deliveryId)
      if (!map.has(k)) {
        map.set(k, {
          deliveryId: d.deliveryId,
          fecha: d.fecha,
          facturaId: d.facturaId ?? null,
          invoiceCode: d.invoiceCode ?? null,
          currency: d.currency || 'PEN',
          lines: []
        })
      }
      map.get(k).lines.push({
        lineId: d.lineId,
        descriptionOrderId: d.descriptionOrderId,
        peso: Number(d.peso || 0),
        unitPrice: d.unitPrice != null ? Number(d.unitPrice) : null,
        subtotal: Number(d.subtotal || 0),
        currency: d.currency || 'PEN',
        descripcion: d.descripcion || null
      })
    }
    const arr = Array.from(map.values())
    for (const g of arr) {
      g.pesoTotal = g.lines.reduce((a, l) => a + (Number(l.peso) || 0), 0)
      g.subtotalTotal = g.lines.reduce((a, l) => a + (Number(l.subtotal) || 0), 0)
      g.totalConIGV = +(g.subtotalTotal * (1 + IGV)).toFixed(2)
    }
    arr.sort((a,b) => {
      const ta = new Date(a.fecha).getTime()
      const tb = new Date(b.fecha).getTime()
      if (tb !== ta) return tb - ta
      return Number(b.deliveryId) - Number(a.deliveryId)
    })
    return arr
  }, [deliveries])

  if (loading) return <section className="card">Cargando…</section>
  if (!order)  return <section className="card">Pedido no encontrado</section>

  const isCancelado = String(order.state).toUpperCase() === 'CANCELADO'
  const productLabel = (p) => p.name || p.DESCRIPCION || `Producto #${p.id}`

  return (
    <section className="card" style={{ position:'relative' }}>
      {/* Toast */}
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
          Entregado: {fmtKg(totals.entregado)} / {fmtKg(totals.pedido)} kg
        </div>
      </div>

      <h4 style={{ marginTop:16 }}>Líneas del pedido</h4>
      <div className="table">
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
                  <input
                    type="number" step="1" min="1" value={editForm.presentacion}
                    onChange={e=>setEditForm(f=>({ ...f, presentacion: e.target.value }))}
                  />
                </div>
                <div>
                  <input
                    type="number" step="0.01" min={l.entregado} value={editForm.peso}
                    onChange={e=>setEditForm(f=>({ ...f, peso: e.target.value }))}
                  />
                </div>
                <div>{fmtKg(l.entregado)} kg</div>
                <div>{fmtKg(Math.max(0, Number(editForm.peso||0)-l.entregado))} kg</div>
                <div style={{ display:'flex', gap:6 }}>
                  <button className="btn" onClick={()=>submitEdit(l.id)}>Guardar</button>
                  <button className="btn-secondary" onClick={cancelEdit}>Cancelar</button>
                </div>
              </>
            ) : (
              <>
                <div>{Number(l.presentacion || 0).toFixed(0)}</div>
                <div>{fmtKg(l.pedido)} kg</div>
                <div>{fmtKg(l.entregado)} kg</div>
                <div>{fmtKg(l.pendiente)} kg</div>
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
          <form onSubmit={submitAddLine} className="form-row" style={{ alignItems:'end' }}>
            {/* Autocomplete de Producto */}
            <div style={{ flex:1 }}>
              <Autocomplete
                label="Producto"
                value={newLine.productId}
                display={newLine.productLabel}
                options={products}
                getLabel={productLabel}
                getKey={(p)=> p.id}
                placeholder="Escribe nombre/código…"
                onChange={(id, obj)=> setNewLine(v=>({ ...v, productId: id, productLabel: productLabel(obj) }))}
              />
            </div>

            <label className="form-field">
              <span>Peso (kg)</span>
              <input
                type="number" step="0.01" min="0.01" value={newLine.peso}
                onChange={e=>setNewLine(v=>({ ...v, peso: e.target.value }))} required
              />
            </label>
            <label className="form-field">
              <span>Presentación</span>
              <input
                type="number" step="1" min="1" value={newLine.presentacion}
                onChange={e=>setNewLine(v=>({ ...v, presentacion: e.target.value }))} required
              />
            </label>
            <div className="form-actions">
              <button className="btn" disabled={!canAddLine}>Agregar</button>
            </div>
          </form>
        </div>
      )}

      {/* ===== Entregas realizadas ===== */}
      <div className="topbar" style={{ marginTop:16, marginBottom:0 }}>
        <h4 style={{ margin:0 }}>Entregas realizadas</h4>
        <div style={{ flex:1 }} />
        {puedeEntregar && !isCancelado && (
          <button className="btn" onClick={() => navigate(`/app/entregas/orden/${id}`)}>
            + Nueva entrega
          </button>
        )}
      </div>

      {grouped.length === 0 && <div className="muted" style={{marginTop:8}}>Sin entregas</div>}

      {grouped.map(g => (
        <div key={g.deliveryId} className="card" style={{ marginTop:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <div style={{ fontWeight:600 }}>
              Entrega #{g.deliveryId} · {new Date(g.fecha).toLocaleString()}
            </div>
            <div className="muted">
              Factura: {g.invoiceCode ? <b>{g.invoiceCode}</b> : 'Sin factura'}
            </div>
            <div style={{ flex:1 }} />
            <div className="muted">
              Subtotal: {fmtMoney(g.subtotalTotal)} {g.currency} · <b>Total (c/IGV): {fmtMoney(g.totalConIGV)} {g.currency}</b>
            </div>
          </div>

          <div className="table" style={{ marginTop:10 }}>
            <div className="table__head" style={{ gridTemplateColumns:'1fr 1fr 1fr 1fr 2fr' }}>
              <div>Peso</div>
              <div>Precio</div>
              <div>Subtotal</div>
              <div>Total</div>
              <div>Comentario</div>
            </div>
            {g.lines.map((l, idx) => {
              const totalLinea = (Number(l.subtotal||0) * (1 + IGV))
              return (
                <div key={`${g.deliveryId}-${l.lineId}-${idx}`} className="table__row" style={{ gridTemplateColumns:'1fr 1fr 1fr 1fr 2fr' }}>
                  <div>{fmtKg(l.peso)} kg</div>
                  <div>{l.unitPrice != null ? fmtMoney(l.unitPrice) : '0.00'} {l.currency}</div>
                  <div>{fmtMoney(l.subtotal)} {l.currency}</div>
                  <div>{fmtMoney(totalLinea)} {l.currency}</div>
                  <div>{l.descripcion || <span className="muted">—</span>}</div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

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
