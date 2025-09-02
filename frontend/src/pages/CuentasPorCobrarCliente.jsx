// frontend/src/pages/CuentasPorCobrarCliente.jsx
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchCustomerReceivable } from '../api/receivables'
import { createPayment, listPaymentsByOrder } from '../api/payments'

const fmt = n => (Number(n)||0).toFixed(2)
const fmtDate = (d) => new Date(d).toLocaleDateString()
const fmtDateTime = (d) => new Date(d).toLocaleString()

// ====== Encabezado configurable de la empresa ======
const COMPANY = {
  name: 'ANCA NYLON SAC',
  ruc: '206010444',
  address: '',
  phone: '',
  email: ''
}

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

  if (loading && !data) return <section className="card">Cargando…</section>
  if (!data) return <section className="card">Cliente no encontrado</section>

  // ====== Imprimir informe (abrir ventana primero para evitar bloqueos) ======
  // Reemplaza toda la función onPrint por esta versión con fallback
const onPrint = () => {
  // Intento 1: abrir ventana sincrónicamente (si se permite, mejor UX)
  const w = window.open('', '_blank', 'noopener,noreferrer');
  const openWasBlocked = !w;

  // Función que imprime en una ventana YA abierta
  const writeAndPrintInWindow = (targetWin, html) => {
    targetWin.document.open();
    targetWin.document.write(html);
    targetWin.document.close();
    targetWin.focus();
    targetWin.print();
  };

  // Si tenemos ventana, pintamos un “Generando…”
  if (w) {
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>Generando…</title></head><body style="font-family:system-ui,Segoe UI,Roboto,Arial"><p>Generando reporte…</p></body></html>`);
    w.document.close();
  }

  // Carga asíncrona de pagos + composición del HTML final
  (async () => {
    try {
      const mapPagos = new Map();
      await Promise.all(items.map(async (it) => {
        const pagos = await listPaymentsByOrder(it.orderId).catch(()=>[]);
        mapPagos.set(it.orderId, Array.isArray(pagos) ? pagos : []);
      }));

      const todayTxt = fmtDateTime(new Date());
      const headHtml = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px">
          <div>
            <div style="font-size:20px; font-weight:700;">${COMPANY.name}</div>
            <div style="color:#555;">RUC: ${COMPANY.ruc}</div>
            ${COMPANY.address ? `<div style="color:#555;">${COMPANY.address}</div>` : ''}
            ${COMPANY.phone ? `<div style="color:#555;">${COMPANY.phone}</div>` : ''}
            ${COMPANY.email ? `<div style="color:#555;">${COMPANY.email}</div>` : ''}
          </div>
          <div style="text-align:right">
            <div style="font-size:18px; font-weight:700;">Informe de Cuentas por Cobrar</div>
            <div style="color:#555;">Generado: ${todayTxt}</div>
          </div>
        </div>
        <hr style="border:none; border-top:1px solid #ddd; margin:10px 0" />
        <div style="display:flex; justify-content:space-between; gap:16px; margin:12px 0">
          <div>
            <div><b>Cliente:</b> ${data.customerName}</div>
            <div><b>RUC:</b> ${data.RUC}</div>
          </div>
          <div style="text-align:right">
            <div><b>Total:</b> S/ ${fmt(data.totalPedidosPEN)}</div>
            <div><b>Pagado:</b> S/ ${fmt(data.totalPagadoPEN)}</div>
            <div><b>Saldo:</b> S/ ${fmt(data.saldoPEN)}</div>
          </div>
        </div>
      `;

      const rowsHtml = items.map(it => {
        const pagos = mapPagos.get(it.orderId) || [];
        const pagosHtml = pagos.length ? `
          <table style="width:100%; border-collapse:collapse; font-size:12px; margin-top:6px">
            <thead>
              <tr>
                <th style="text-align:left; padding:6px; border:1px solid #e5e5e5;">Fecha</th>
                <th style="text-align:left; padding:6px; border:1px solid #e5e5e5;">Método</th>
                <th style="text-align:left; padding:6px; border:1px solid #e5e5e5;">Operación</th>
                <th style="text-align:left; padding:6px; border:1px solid #e5e5e5;">Observación</th>
                <th style="text-align:right; padding:6px; border:1px solid #e5e5e5;">Monto</th>
              </tr>
            </thead>
            <tbody>
              ${pagos.map(p => `
                <tr>
                  <td style="padding:6px; border:1px solid #eee;">${fmtDate(p.paymentDate || p.PAYMENT_DATE)}</td>
                  <td style="padding:6px; border:1px solid #eee;">${p.method || p.METHOD}</td>
                  <td style="padding:6px; border:1px solid #eee;">${p.reference || p.REFERENCE || ''}</td>
                  <td style="padding:6px; border:1px solid #eee;">${p.notes || p.OBSERVACION || ''}</td>
                  <td style="padding:6px; border:1px solid #eee; text-align:right;">${fmt(p.amount || p.AMOUNT)} ${p.currency || p.CURRENCY || 'PEN'}</td>
                </tr>`).join('')}
            </tbody>
          </table>` : `<div style="color:#777; font-size:12px; margin-top:6px">Sin pagos</div>`;

        return `
          <div style="border:1px solid #e5e5e5; border-radius:8px; padding:10px; margin:10px 0">
            <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
              <div>
                <div style="font-weight:700;">Pedido #${it.orderId}</div>
                <div style="color:#555;">${fmtDateTime(it.fecha)}</div>
                <div style="color:#555;">Facturas: ${it.invoices || '—'}</div>
                <div style="color:#555;">Estado: ${it.estado}</div>
              </div>
              <div style="text-align:right">
                <div><b>Total:</b> S/ ${fmt(it.total)}</div>
                <div><b>Pagado:</b> S/ ${fmt(it.pagado)}</div>
                <div><b>Saldo:</b> S/ ${fmt(it.saldo)}</div>
              </div>
            </div>
            ${pagosHtml}
          </div>`;
      }).join('');

      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Informe CxC - ${data.customerName}</title>
  <style>
    @media print { @page { margin: 16mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size: 14px; color: #111; margin: 24px; }
  </style>
</head>
<body>
  ${headHtml}
  <div style="margin-top:12px; font-size:16px; font-weight:700;">Pedidos (${balance === 'with' ? 'solo con saldo' : balance === 'without' ? 'pagados' : 'todos'})</div>
  ${rowsHtml || '<div style="margin-top:8px; color:#777">No hay pedidos en este filtro.</div>'}
</body>
</html>`;

      if (!openWasBlocked) {
        // Ventana ya abierta → escribir e imprimir allí
        writeAndPrintInWindow(w, html);
      } else {
        // Fallback: iframe oculto (no bloquea)
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow || iframe.contentDocument;
        const win = doc.window || doc;
        doc.document.open();
        doc.document.write(html);
        doc.document.close();
        setTimeout(() => {
          win.focus();
          win.print();
          // Limpieza
          setTimeout(() => document.body.removeChild(iframe), 1000);
        }, 100);
      }
    } catch (e) {
      console.error(e);
      if (!openWasBlocked && w) {
        writeAndPrintInWindow(w, '<p style="font-family:system-ui">No se pudo generar el informe.</p>');
      } else {
        alert('No se pudo generar el informe.');
      }
    }
  })();
};

  return (
    <section className="card">
      {/* HEADER */}
      <div className="topbar" style={{ marginBottom:0 }}>
        <h3 style={{ margin:0 }}>{data.customerName} · {data.RUC}</h3>
        <div style={{ flex:1 }} />
        {/* KPIs grandes */}
        <div style={{
          display:'grid',
          gridTemplateColumns:'repeat(3, minmax(0, 1fr))',
          gap:8,
          minWidth: 420
        }}>
          <div className="card" style={{ padding:12 }}>
            <div className="muted">Total</div>
            <div style={{ fontSize:20, fontWeight:700 }}>S/ {fmt(data.totalPedidosPEN)}</div>
          </div>
          <div className="card" style={{ padding:12 }}>
            <div className="muted">Pagado</div>
            <div style={{ fontSize:20, fontWeight:700, color:'#1a7f37' }}>S/ {fmt(data.totalPagadoPEN)}</div>
          </div>
          <div className="card" style={{ padding:12 }}>
            <div className="muted">Saldo</div>
            <div style={{ fontSize:20, fontWeight:700, color:'#b42318' }}>S/ {fmt(data.saldoPEN)}</div>
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <form
        onSubmit={(e)=>{ e.preventDefault(); load() }}
        style={{
          display:'grid',
          gridTemplateColumns:'1fr 1fr 1fr auto',
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
          <button className="btn" type="button" onClick={onPrint}>Imprimir informe</button>
        </div>
      </form>

      {msg && <div className="muted" style={{ marginTop:8 }}>{msg}</div>}

      {/* TABLA */}
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
              <div style={{ fontWeight:700, color: completo ? 'var(--success)' : 'inherit' }}>
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
