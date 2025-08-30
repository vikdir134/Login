// frontend/src/pages/CuentasPorCobrarCliente.jsx
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchCustomerReceivable } from '../api/receivables'
import { createPayment } from '../api/payments' // usa tu endpoint POST /api/orders/:orderId/payments

const fmt = n => (Number(n)||0).toFixed(2)
const fmtDateTime = (d) => new Date(d).toLocaleString()

function PayModal({ open, onClose, orderId, onDone }) {
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0,10))
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('EFECTIVO')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')

  if (!open) return null
  const submit = async (e) => {
    e.preventDefault()
    setSending(true); setMsg('')
    try {
      await createPayment(orderId, {
        orderId: Number(orderId),         // el route lo pisará igual, pero por si acaso
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

export default function CuentasPorCobrarCliente() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [onlySaldo, setOnlySaldo] = useState(true)

  const [payOpen, setPayOpen] = useState(false)
  const [payOrderId, setPayOrderId] = useState(null)

  const load = async () => {
    setLoading(true); setMsg('')
    try {
      const d = await fetchCustomerReceivable(id, { onlyWithBalance: onlySaldo })
      setData(d)
    } catch (e) {
      console.error(e); setMsg('Error cargando detalle del cliente')
    } finally { setLoading(false) }
  }

  useEffect(()=>{ load() /* eslint-disable-line */ }, [id, onlySaldo])

  const items = useMemo(()=> Array.isArray(data?.items) ? data.items : [], [data])

  if (loading && !data) return <section className="card">Cargando…</section>
  if (!data) return <section className="card">Cliente no encontrado</section>

  return (
    <section className="card">
      <div className="topbar" style={{ marginBottom:0 }}>
        <h3 style={{ margin:0 }}>{data.customerName} · {data.RUC}</h3>
        <div style={{ flex:1 }} />
        <div className="muted">
          <b>Total:</b> S/ {fmt(data.totalPedidosPEN)} · <b>Pagado:</b> S/ {fmt(data.totalPagadoPEN)} · <b>Saldo:</b> S/ {fmt(data.saldoPEN)}
        </div>
      </div>

      <div style={{ display:'flex', gap:12, alignItems:'center', marginTop:12 }}>
        <label style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type="checkbox" checked={onlySaldo} onChange={e=>setOnlySaldo(e.target.checked)} />
          Solo pedidos con saldo
        </label>
        <button className="btn-secondary" onClick={()=>{/* futuro: PDF */}}>Generar reporte PDF</button>
      </div>

      {msg && <div className="muted" style={{ marginTop:8 }}>{msg}</div>}

      <div className="table" style={{ marginTop:14 }}>
        <div className="table__head" style={{ gridTemplateColumns:'1fr 1.8fr 1fr 1fr 1fr auto' }}>
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
            <div className="table__row" key={r.orderId} style={{ gridTemplateColumns:'1fr 1.8fr 1fr 1fr 1fr auto' }}>
              <div>#{r.orderId}</div>
              <div>{r.invoices || <span className="muted">—</span>}</div>
              <div>{fmtDateTime(r.fecha)}</div>
              <div>{fmt(r.total)}</div>
              <div>{fmt(r.pagado)}</div>
              <div style={{ fontWeight:700, color: completo ? 'var(--success)' : 'inherit' }}>
                {fmt(r.saldo)} {completo && <span className="badge badge--success" style={{ marginLeft:8 }}>Completado</span>}
              </div>
              <div>
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

      <PayModal
        open={payOpen}
        onClose={()=>setPayOpen(false)}
        orderId={payOrderId}
        onDone={load}
      />
    </section>
  )
}
