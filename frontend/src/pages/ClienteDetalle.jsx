// src/pages/ClienteDetalle.jsx
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchCustomerSummary } from '../api/customers'
import { fetchCustomerReceivable } from '../api/receivables' // ⬅️ NUEVO

const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '—'
const fmtDateTime = (d) => new Date(d).toLocaleString()
const moneySymbol = (currency) => (currency === 'PEN' ? 'S/' : currency || '')
const fmtMoney = (n) => (Number(n) || 0).toFixed(2)

const STATE_OPTS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'EN_PROCESO', label: 'En proceso' },
  { value: 'ENTREGADO', label: 'Entregado' },
  { value: 'CANCELADO', label: 'Cancelado' },
]

const pillClass = (state) => {
  const s = String(state || '').toUpperCase()
  const base = 'badge'
  const rounded = { borderRadius: 9999, padding: '4px 10px' }
  switch (s) {
    case 'PENDIENTE':   return { className: base + ' badge--danger',   style: rounded }
    case 'EN_PROCESO':  return { className: base + ' badge--warning',  style: rounded }
    case 'ENTREGADO':   return { className: base + ' badge--success',  style: rounded }
    case 'CANCELADO':   return { className: base + ' badge--dark',     style: rounded }
    default:            return { className: base, style: rounded }
  }
}

export default function ClienteDetalle() {
  const { id } = useParams()

  // Filtros
  const [q, setQ] = useState('')                  // búsqueda rápida client-side (ID/fecha/total)
  const [stateSel, setStateSel] = useState('ALL') // estado
  const [from, setFrom] = useState('')            // YYYY-MM-DD
  const [to, setTo] = useState('')                // YYYY-MM-DD

  // Paginación
  const [page, setPage] = useState(0)
  const pageSize = 10

  // Data
  const [info, setInfo] = useState(null)
  const [kpis, setKpis] = useState(null)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)

  // UI
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const statesParam = useMemo(() => {
    if (stateSel === 'ALL') return undefined
    return stateSel
  }, [stateSel])

  const load = async () => {
    setLoading(true); setMsg('')
    try {
      // Pedidos + KPIs operativos
      const data = await fetchCustomerSummary(id, {
        states: statesParam,
        from: from || undefined,
        to: to || undefined,
        limit: pageSize,
        offset: page * pageSize
      })

      setInfo(data.customer || null)
      setRows(Array.isArray(data?.orders?.items) ? data.orders.items : [])
      setTotal(Number(data?.orders?.total || 0))

      // KPIs operativos base
      const baseKpis = data.kpis || {}

      // ⬇️ KPIs financieros (Pagado/Saldo)
      // onlyWithBalance:false para traer totales completos del cliente
      const recv = await fetchCustomerReceivable(id, { onlyWithBalance: false }).catch(() => null)

      setKpis({
        ...baseKpis,
        totalPagadoPEN: recv?.totalPagadoPEN ?? 0,
        saldoPEN: recv?.saldoPEN ?? Math.max(0, (baseKpis?.totalByCurrency?.PEN ?? 0) - 0)
      })
    } catch (e) {
      console.error(e)
      setMsg('Error cargando datos de cliente')
    } finally {
      setLoading(false)
    }
  }

  // Cargar cuando cambian filtros/página
  useEffect(() => {
    load()
  }, [id, statesParam, from, to, page])

  // Resetear página cuando cambien filtros
  useEffect(() => { setPage(0) }, [statesParam, from, to])

  // Filtro rápido client-side (sobre la página actual)
  const filteredRows = useMemo(() => {
    if (!q.trim()) return rows
    const term = q.trim().toLowerCase()
    return rows.filter(r => {
      const idTxt = `#${r.id}`
      const fecha = fmtDateTime(r.fecha)
      const totalTxt = fmtMoney(r.total)
      return (
        idTxt.toLowerCase().includes(term) ||
        fecha.toLowerCase().includes(term) ||
        totalTxt.toLowerCase().includes(term)
      )
    })
  }, [q, rows])

  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize))
  const canPrev = page > 0
  const canNext = (page + 1) * pageSize < total

  if (loading && !info) return <section className="card">Cargando…</section>
  if (!info) return <section className="card">Cliente no encontrado</section>

  // KPI helpers (operativos)
  const lastDate = kpis?.lastOrderDate ? fmtDate(kpis.lastOrderDate) : '—'
  const ordersCount = kpis?.ordersCount ?? 0
  const fulfillment = kpis?.fulfillmentPct ?? 0
  const pendingCount = kpis?.pendingCount ?? 0
  const pedidoKg = kpis?.pedidoKg ?? 0
  const entregadoKg = kpis?.entregadoKg ?? 0

  // Monto acumulado (operativo)
  const penTotal = kpis?.totalByCurrency?.PEN ?? 0
  const otherCurrencies = Object.entries(kpis?.totalByCurrency || {}).filter(([c]) => c !== 'PEN')

  // ⬇️ KPIs financieros
  const totalPagado = kpis?.totalPagadoPEN ?? 0
  const saldo = kpis?.saldoPEN ?? Math.max(0, penTotal - totalPagado)

  return (
    <section className="card">
      {/* Header */}
      <header style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h3 style={{ margin:0 }}>{info.razonSocial}</h3>
          <div className="muted">
            RUC: {info.RUC} · {info.activo ? <span style={{ color:'#1a7f37', fontWeight:600 }}>Activo</span> : <span style={{ color:'#b42318', fontWeight:600 }}>Inactivo</span>}
          </div>
        </div>
        {/* (opcional) link a CxC del cliente */}
        <Link className="btn-secondary" to={`/app/cxc/${id}`}>Cuentas por cobrar</Link>
      </header>

      {/* KPIs (incluye Pagado/Saldo) */}
      <div style={{
        display:'grid',
        gridTemplateColumns:'repeat(6, minmax(0, 1fr))', // ⬅️ 6 tarjetas
        gap:12,
        marginTop:14
      }}>
        <div className="card" style={{ padding:16 }}>
          <div className="muted">Pedidos totales</div>
          <div style={{ fontSize:24, fontWeight:700 }}>{ordersCount}</div>
        </div>

        <div className="card" style={{ padding:16 }}>
          <div className="muted">Monto acumulado</div>
          <div style={{ fontSize:24, fontWeight:700 }}>
            {moneySymbol('PEN')} {fmtMoney(penTotal)}
          </div>
          {otherCurrencies.length > 0 && (
            <div className="muted" style={{ marginTop:4, fontSize:12 }}>
              {otherCurrencies.map(([c, v]) => `${moneySymbol(c)} ${fmtMoney(v)}`).join(' · ')}
            </div>
          )}
        </div>

        <div className="card" style={{ padding:16 }}>
          <div className="muted">Último pedido</div>
          <div style={{ fontSize:24, fontWeight:700 }}>{lastDate}</div>
        </div>

        <div className="card" style={{ padding:16 }}>
          <div className="muted">% cumplimiento</div>
          <div style={{ fontSize:24, fontWeight:700 }}>{fulfillment}%</div>
          <div className="muted" style={{ fontSize:12 }}>{pendingCount} pendientes</div>
        </div>

        {/* ⬇️ NUEVOS KPIs */}
        <div className="card" style={{ padding:16 }}>
          <div className="muted">Pagado</div>
          <div style={{ fontSize:24, fontWeight:700 }}>S/ {fmtMoney(totalPagado)}</div>
        </div>

        <div className="card" style={{ padding:16 }}>
          <div className="muted">Saldo</div>
          <div style={{ fontSize:24, fontWeight:700 }}>S/ {fmtMoney(saldo)}</div>
        </div>
      </div>

      {/* Extra KPI barra sencilla */}
      <div className="progress" style={{ marginTop:16 }}>
        <div className="progress__label">Avance por kilos</div>
        <div className="progress__bar">
          <div className="progress__bar_fill" style={{ width: `${pedidoKg ? Math.min(100, (entregadoKg / pedidoKg) * 100) : 0}%` }} />
        </div>
        <div className="muted">
          Entregado: {fmtMoney(entregadoKg)} / {fmtMoney(pedidoKg)} kg
        </div>
      </div>

      {/* Filtros */}
      <div style={{
        display:'grid',
        gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr',
        gap:10,
        marginTop:16,
        alignItems:'end'
      }}>
        <label className="form-field">
          <span>Buscar</span>
          <input
            placeholder="Por ID, fecha (AAAA-MM-DD) o total…"
            value={q}
            onChange={e=>setQ(e.target.value)}
          />
        </label>

        <label className="form-field">
          <span>Estado</span>
          <select value={stateSel} onChange={e=>setStateSel(e.target.value)}>
            {STATE_OPTS.map(o=> <option key={o.value} value={o.value}>{o.label}</option>)}
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

        <div className="form-field">
          <span>&nbsp;</span>
          <button className="btn-secondary" onClick={()=>{ setFrom(''); setTo(''); setStateSel('ALL'); setQ(''); }}>
            Limpiar
          </button>
        </div>
      </div>

      {/* Tabla pedidos */}
      <div className="table" style={{ marginTop:14 }}>
        <div className="table__head" style={{ gridTemplateColumns:'0.6fr 1.2fr 1fr 1fr auto' }}>
          <div>ID</div>
          <div>Fecha</div>
          <div>Total</div>
          <div>Estado</div>
          <div>Acciones</div>
        </div>

        {!loading && filteredRows.map(o => {
          const pill = pillClass(o.state || o.estado)
          return (
            <div className="table__row" key={o.id} style={{ gridTemplateColumns:'0.6fr 1.2fr 1fr 1fr auto' }}>
              <div>#{o.id}</div>
              <div>{fmtDateTime(o.fecha)}</div>
              <div>{moneySymbol(o.currency)} {fmtMoney(o.total)}</div>
              <div><span className={pill.className} style={pill.style}>{o.state || o.estado}</span></div>
              <div>
                <Link className="btn-secondary" to={`/app/pedidos/${o.id}`}>Ver</Link>
              </div>
            </div>
          )
        })}

        {loading && <div className="muted">Cargando…</div>}
        {!loading && filteredRows.length === 0 && <div className="muted">Sin pedidos</div>}
      </div>

      {/* Paginación */}
      <div style={{ display:'flex', gap:8, marginTop:10, alignItems:'center' }}>
        <button className="btn-secondary" disabled={!canPrev} onClick={()=>setPage(p=>Math.max(0, p-1))}>Anterior</button>
        <div className="muted">Página {page+1} de {totalPages}</div>
      <button className="btn-secondary" disabled={!canNext} onClick={()=>setPage(p=>p+1)}>Siguiente</button>
      </div>

      {msg && <div className="muted" style={{ marginTop:8 }}>{msg}</div>}
    </section>
  )
}
