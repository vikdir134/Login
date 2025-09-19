// frontend/src/pages/CuentasPorCobrarCliente.jsx
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchCustomerReceivable } from '../api/receivables'
import { createPayment, listPaymentsByDelivery } from '../api/payments'

import { COMPANY } from '../config/company'
import { printHTML } from '../utils/print'

// 👉 Usamos los NUEVOS builders tipo “excel”
import {
  buildCxCDocsSummaryHTML,
  buildInvoicePaymentsHTML_Grid
} from '../reports/cxcClienteDocsSimple'

const fmt = n => (Number(n)||0).toFixed(2)
const fmtDateTime = (d) => new Date(d).toLocaleString()

// Base del API para componer URLs absolutas a /uploads
const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

/* ===================== MODAL: PAGAR (por ENTREGA) ===================== */
function PayModal({ open, onClose, deliveryId, onDone }) {
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
      await createPayment({
        orderDeliveryId: Number(deliveryId),
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
          <h4 style={{ margin:0 }}>Registrar pago · Entrega #{deliveryId}</h4>
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

/* ========== MODAL: HISTORIAL DE PAGOS (por ENTREGA) ========== */
function PaymentsHistoryModal({ open, onClose, deliveryId }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    if (!open || !deliveryId) return
    setLoading(true)
    listPaymentsByDelivery(deliveryId)
      .then(data => { if (alive) setRows(Array.isArray(data)? data:[]) })
      .finally(()=> { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [open, deliveryId])

  if (!open) return null

  const fmtDate = (d) => new Date(d).toLocaleDateString()

  return (
    <div className="modal modal--center">
      <div className="modal__card" style={{ minWidth: 640 }}>
        <div className="modal__header">
          <h4 style={{ margin:0 }}>Historial de pagos · Entrega #{deliveryId}</h4>
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

/* ===================== PAGE ===================== */
export default function CuentasPorCobrarCliente() {
  const { id } = useParams()

  const [balance, setBalance] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const [payOpen, setPayOpen] = useState(false)
  const [payDeliveryId, setPayDeliveryId] = useState(null)
  const [histOpen, setHistOpen] = useState(false)
  const [histDeliveryId, setHistDeliveryId] = useState(null)

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

  const clearFilters = () => { setBalance('all'); setFrom(''); setTo('') }

  // Imprime RESUMEN POR DOCUMENTOS (tipo excel)
  const onPrint = () => {
    const html = buildCxCDocsSummaryHTML({
      company: COMPANY,
      client: { customerName: data.customerName, RUC: data.RUC },
      items
    })
    printHTML(html)
  }

  // Helper para armar URL absoluta hacia el backend
  const docUrl = (p) => {
    if (!p) return null
    const s = String(p)
    if (/^https?:\/\//i.test(s)) return s
    if (s.startsWith('/')) return `${API_BASE}${s}`
    return `${API_BASE}/uploads/${s}`
  }

  return (
    <section className="card">
      <div className="topbar" style={{ marginBottom:0 }}>
        <h3 style={{ margin:0 }}>{data.customerName} · {data.RUC}</h3>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12, marginTop:14 }}>
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
        style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto auto', gap:8, marginTop:12, alignItems:'end' }}
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

      {/* Tabla: UNA FILA POR ENTREGA (mostrando FACTURA) */}
      <div className="table" style={{ marginTop:14 }}>
        <div className="table__head" style={{ gridTemplateColumns:'1.2fr 2fr 1fr 1fr 1fr auto' }}>
          <div>Factura</div>
          <div>Documentos</div>
          <div>Fecha</div>
          <div>Total (S/)</div>
          <div>Pagado</div>
          <div>Saldo</div>
          <div>Acciones</div>
        </div>

        {items.map(r => {
          const deliveryId = r.deliveryId
          const orderId = r.orderId
          const facturaUrl = docUrl(r.invoicePath)
          const guiaUrl = docUrl(r.guiaPath)
          const completo = Number(r.saldo) <= 0.0001

          return (
            <div className="table__row" key={`${deliveryId}-${orderId}`} style={{ gridTemplateColumns:'1.2fr 2fr 1fr 1fr 1fr auto' }}>
              <div>{r.invoiceCode ?? '—'}</div>

              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {r.invoiceCode
                  ? (facturaUrl
                      ? <a className="btn-secondary" href={facturaUrl} target="_blank" rel="noopener noreferrer">Factura {r.invoiceCode}</a>
                      : <span className="badge">Factura {r.invoiceCode}</span>)
                  : <span className="muted">Sin factura</span>
                }

                {r.guiaCode
                  ? (guiaUrl
                      ? <a className="btn-secondary" href={guiaUrl} target="_blank" rel="noopener noreferrer">Guía {r.guiaCode}</a>
                      : <span className="badge">Guía {r.guiaCode}</span>)
                  : <span className="muted">Sin guía</span>
                }
              </div>

              <div>{fmtDateTime(r.fecha)}</div>
              <div>{fmt(r.total)}</div>
              <div>{fmt(r.pagado)}</div>
              <div style={{ fontWeight:700 }}>
                {fmt(r.saldo)} {completo && <span className="badge badge--success" style={{ marginLeft:8 }}>Completado</span>}
              </div>

              <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                <button
                  className="btn-secondary"
                  onClick={()=>{ setHistDeliveryId(deliveryId); setHistOpen(true) }}
                  title="Ver historial de pagos de esta entrega"
                >
                  Historial
                </button>
                {!completo && (
                  <button className="btn" onClick={()=>{ setPayDeliveryId(deliveryId); setPayOpen(true) }}>
                    Pagar
                  </button>
                )}
                {r.invoiceCode && (
                  <button
                    className="btn-secondary"
                    title="Imprimir pagos de esta factura"
                    onClick={async ()=> {
                      try {
                        // Todas las entregas de la misma factura en el dataset actual
                        const rowsSameInvoice = items.filter(x => x.invoiceCode === r.invoiceCode)
                        // Trae pagos por CADA ENTREGA (no por pedido)
                        const allPayments = []
                        for (const row of rowsSameInvoice) {
                          const pp = await listPaymentsByDelivery(row.deliveryId).catch(()=>[])
                          if (Array.isArray(pp)) allPayments.push(...pp)
                        }
                        const html = buildInvoicePaymentsHTML_Grid({
                          company: COMPANY,
                          client: { customerName: data.customerName, RUC: data.RUC },
                          invoiceCode: r.invoiceCode,
                          rows: rowsSameInvoice,
                          payments: allPayments
                        })
                        printHTML(html)
                      } catch (e) {
                        console.error(e)
                        alert('No se pudo generar el informe de la factura.')
                      }
                    }}
                  >
                    Imprimir (factura)
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {items.length===0 && <div className="muted">Sin entregas</div>}
      </div>

      {/* Modales */}
      <PayModal
        open={payOpen}
        onClose={()=>setPayOpen(false)}
        deliveryId={payDeliveryId}
        onDone={load}
      />
      <PaymentsHistoryModal
        open={histOpen}
        onClose={()=>setHistOpen(false)}
        deliveryId={histDeliveryId}
      />
    </section>
  )
}
