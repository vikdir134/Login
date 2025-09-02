// frontend/src/pages/CuentasPorCobrarCliente.jsx
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchCustomerReceivable } from '../api/receivables'
import { createPayment, listPaymentsByOrder } from '../api/payments'

// Config / utilidades
import { COMPANY } from '../config/company'
import { printHTML } from '../utils/print'
import { buildCxCClienteReportHTML } from '../reports/cxcClienteReport'

const fmt = n => (Number(n)||0).toFixed(2)
const fmtDate = (d) => new Date(d).toLocaleDateString()
const fmtDateTime = (d) => new Date(d).toLocaleString()

// ====== Modal: Pagar ======
function PayModal({ open, onClose, orderId, onDone }) {
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0,10))
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('EFECTIVO')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(()=> {
    if (!open) return
    setPaymentDate(new Date().toISOString().slice(0,10))
    setAmount(''); setMethod('EFECTIVO'); setReference(''); setNotes('')
    setSending(false); setMsg('')
  }, [open])

  if (!open) return null

  const submit = async (e) => {
    e.preventDefault()
    setSending(true); setMsg('')
    try {
      await createPayment(orderId, {
        orderId: Number(orderId),
        paymentDate,
        amount: Number(amount),
        method,
        reference: method==='EFECTIVO' ? null : (reference || null),
        notes: notes || null,
        currency: 'PEN'
      })
      onDone?.()
      onClose?.()
    } catch (e) {
      setMsg(e.response?.data?.error || 'Error creando pago')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="modal modal--center">
      <div className="modal__card" style={{ minWidth: 520 }}>
        <div className="modal__header">
          <h4 style={{ margin:0 }}>Registrar pago · Pedido #{orderId}</h4>
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
        <form onSubmit={submit} className="form-col" style={{ gap:10 }}>
          <label className="form-field">
            <span>Fecha</span>
            <input type="date" value={paymentDate} onChange={e=>setPaymentDate(e.target.value)} required />
          </label>
          <label className="form-field">
            <span>Monto (S/)</span>
            <input type="number" step="0.01" min="0.01" value={amount} onChange={e=>setAmount(e.target.value)} required />
          </label>
          <label className="form-field">
            <span>Método</span>
            <select value={method} onChange={e=>setMethod(e.target.value)}>
              <option value="EFECTIVO">Efectivo</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="TARJETA">Tarjeta</option>
              <option value="OTRO">Otro</option>
            </select>
          </label>
          {method !== 'EFECTIVO' && (
            <label className="form-field">
              <span>N° operación / Banco</span>
              <input value={reference} onChange={e=>setReference(e.target.value)} placeholder="ej. BCP 0123..." />
            </label>
          )}
          <label className="form-field">
            <span>Observación (opcional)</span>
            <input value={notes} onChange={e=>setNotes(e.target.value)} />
          </label>

          {msg && <div className="error">{msg}</div>}
          <div className="form-actions" style={{ justifyContent:'flex-end' }}>
            <button className="btn" disabled={sending || !(Number(amount)>0)}>Registrar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ====== Modal: Historial de pagos del pedido ======
function PaymentsHistoryModal({ open, onClose, orderId }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    if (!open || !orderId) return
    setLoading(true)
    listPaymentsByOrder(orderId)
      .then(data => { if (alive) setRows(Array.isArray(data)? data:[]) })
      .finally(()=> { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [open, orderId])

  if (!open) return null

  return (
    <div className="modal modal--center">
      <div className="modal__card" style={{ minWidth: 640 }}>
        <div className="modal__header">
          <h4 style={{ margin:0 }}>Historial de pagos · Pedido #{orderId}</h4>
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>

        {loading && <div className="muted">Cargando…</div>}
        {!loading && rows.length === 0 && <div className="muted">Sin pagos</div>}
        {!loading && rows.length > 0 && (
          <div className="table" style={{ marginTop: 8 }}>
            <div className="table__head" style={{ gridTemplateColumns:'1fr 1fr 1fr 2fr 2fr' }}>
              <div>Fecha</div>
              <div>Método</div>
              <div>Monto</div>
              <div>Operación</div>
              <div>Observación</div>
            </div>
            {rows.map(r => (
              <div key={r.id} className="table__row" style={{ gridTemplateColumns:'1fr 1fr 1fr 2fr 2fr' }}>
                <div>{fmtDate(r.paymentDate || r.PAYMENT_DATE)}</div>
                <div>{r.method || r.METHOD}</div>
                <div>{fmt(r.amount || r.AMOUNT)} {r.currency || r.CURRENCY || 'PEN'}</div>
                <div>{r.reference || r.REFERENCE || <span className="muted">—</span>}</div>
                <div>{r.notes || r.OBSERVACION || <span className="muted">—</span>}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function CuentasPorCobrarCliente() {
  const { id } = useParams()

  // filtros
  const [balance, setBalance] = useState('all') // 'all' | 'with' | 'without'
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  // modales
  const [payOpen, setPayOpen] = useState(false)
  const [payOrderId, setPayOrderId] = useState(null)
  const [histOpen, setHistOpen] = useState(false)
  const [histOrderId, setHistOrderId] = useState(null)

  const load = async () => {
    setLoading(true); setMsg('')
    try {
      const d = await fetchCustomerReceivable(id, {
        balance,
        from: from || undefined,
        to: to || undefined
      })
      setData(d)
    } catch (e) {
      console.error(e); setMsg('Error cargando detalle del cliente')
    } finally { setLoading(false) }
  }
  useEffect(()=>{ load() /* eslint-disable-line */ }, [id, balance, from, to])

  const items = useMemo(()=> Array.isArray(data?.items) ? data.items : [], [data])

  // KPIs al estilo ClienteDetalle (derivados de ítems filtrados)
  const { kpiTotal, kpiPagado, kpiSaldo } = useMemo(() => {
    const t = items.reduce((a, it) => {
      a.total += Number(it.total || 0)
      a.pagado += Number(it.pagado || 0)
      a.saldo += Number(it.saldo || 0)
      return a
    }, { total:0, pagado:0, saldo:0 })
    return { kpiTotal: t.total, kpiPagado: t.pagado, kpiSaldo: t.saldo }
  }, [items])

  if (loading && !data) return <section className="card">Cargando…</section>
  if (!data) return <section className="card">Cliente no encontrado</section>

  // Limpiar filtros
  const clearFilters = () => {
    setBalance('all')
    setFrom('')
    setTo('')
  }

  // Imprimir informe (usa KPIs filtrados)
  const onPrint = async () => {
    try {
      const paymentsByOrder = new Map()
      await Promise.all(items.map(async (it) => {
        const pagos = await listPaymentsByOrder(it.orderId).catch(()=>[])
        paymentsByOrder.set(it.orderId, Array.isArray(pagos) ? pagos : [])
      }))

      const html = buildCxCClienteReportHTML({
        company: COMPANY,
        client: {
          customerName: data.customerName,
          RUC: data.RUC,
          totalPedidosPEN: kpiTotal,
          totalPagadoPEN: kpiPagado,
          saldoPEN: kpiSaldo
        },
        items,
        paymentsByOrder,
        balance
      })

      printHTML(html)
    } catch (e) {
      console.error(e)
      alert('No se pudo generar el informe.')
    }
  }

  return (
    <section className="card">
      {/* Header */}
      <div className="topbar" style={{ marginBottom:0 }}>
        <h3 style={{ margin:0 }}>{data.customerName} · {data.RUC}</h3>
      </div>

      {/* KPIs estilo ClienteDetalle (3 tarjetas, fuente 24, bold) */}
      <div style={{
        display:'grid',
        gridTemplateColumns:'repeat(3, minmax(0, 1fr))',
        gap:12,
        marginTop:14
      }}>
        <div className="card" style={{ padding:16 }}>
          <div className="muted">Total</div>
          <div style={{ fontSize:24, fontWeight:700 }}>S/ {fmt(kpiTotal)}</div>
        </div>
        <div className="card" style={{ padding:16 }}>
          <div className="muted">Pagado</div>
          <div style={{ fontSize:24, fontWeight:700, color:'#1a7f37' }}>S/ {fmt(kpiPagado)}</div>
        </div>
        <div className="card" style={{ padding:16 }}>
          <div className="muted">Saldo</div>
          <div style={{ fontSize:24, fontWeight:700, color:'#b42318' }}>S/ {fmt(kpiSaldo)}</div>
        </div>
      </div>

      {/* Filtros */}
      <form
        onSubmit={(e)=>{ e.preventDefault(); load() }}
        style={{
          display:'grid',
          gridTemplateColumns:'1fr 1fr 1fr auto auto',
          gap:8,
          marginTop:12,
          alignItems:'end'
        }}
      >
        <label className="form-field">
          <span>Estado del saldo</span>
          <select value={balance} onChange={e=>setBalance(e.target.value)}>
            <option value="all">Todos</option>
            <option value="with">Con saldo</option>
            <option value="without">Sin saldo</option>
          </select>
        </label>
        <label className="form-field">
          <span>Desde</span>
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} />
        </label>
        <label className="form-field">
          <span>Hasta</span>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} />
        </label>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn-secondary" type="submit">Aplicar</button>
          <button className="btn-secondary" type="button" onClick={clearFilters}>Limpiar</button>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <button className="btn" type="button" onClick={onPrint}>Imprimir informe</button>
        </div>
      </form>

      {msg && <div className="muted" style={{ marginTop:8 }}>{msg}</div>}

      {/* Tabla */}
      <div className="table" style={{ marginTop:14 }}>
        <div className="table__head" style={{ gridTemplateColumns:'1fr 1.6fr 1fr 1fr 1fr auto' }}>
          <div>Pedido</div>
          <div>Facturas</div>
          <div>Fecha</div>
          <div>Total (S/)</div>
          <div>Pagado</div>
          <div>Saldo</div>
          <div>Acciones</div>
        </div>

        {items.map(r => {
          const completo = Number(r.saldo) <= 0.0001
          return (
            <div className="table__row" key={r.orderId} style={{ gridTemplateColumns:'1fr 1.6fr 1fr 1fr 1fr auto' }}>
              <div>#{r.orderId}</div>
              <div>{r.invoices || <span className="muted">—</span>}</div>
              <div>{fmtDateTime(r.fecha)}</div>
              <div>{fmt(r.total)}</div>
              <div>{fmt(r.pagado)}</div>
              <div style={{ fontWeight:700 }}>
                {fmt(r.saldo)} {completo && <span className="badge badge--success" style={{ marginLeft:8 }}>Completado</span>}
              </div>
              <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                <button className="btn-secondary" onClick={()=>{ setHistOrderId(r.orderId); setHistOpen(true) }}>
                  Historial
                </button>
                {!completo && (
                  <button className="btn" onClick={()=>{ setPayOrderId(r.orderId); setPayOpen(true) }}>
                    Pagar
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {items.length===0 && <div className="muted">Sin pedidos</div>}
      </div>

      {/* Modales */}
      <PayModal
        open={payOpen}
        onClose={()=>setPayOpen(false)}
        orderId={payOrderId}
        onDone={load}
      />

      <PaymentsHistoryModal
        open={histOpen}
        onClose={()=>setHistOpen(false)}
        orderId={histOrderId}
      />
    </section>
  )
}
