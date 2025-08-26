// src/pages/ClienteDetalle.jsx
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchCustomerSummary } from '../api/customers'
import { listOrders } from '../api/orders'
import { hasRole, getUserFromToken } from '../utils/auth'

const fmtMoney = n => `S/ ${Number(n || 0).toFixed(2)}`
const fmtDate = s => new Date(s).toLocaleDateString()

const badgeStyles = {
  PENDIENTE:  { bg:'#FFF4E5', bd:'#F6C77A', tx:'#B26B00' },
  EN_PROCESO:{ bg:'#EAF2FF', bd:'#9DBAF7', tx:'#2456B3' },
  ENTREGADO: { bg:'#E9F8EE', bd:'#95D5A6', tx:'#1B7A3D' },
  CANCELADO: { bg:'#FFEDEF', bd:'#F6A1AC', tx:'#B11A2B' },
}

function EstadoBadge({ state }) {
  const s = String(state || '').toUpperCase()
  const st = badgeStyles[s] || { bg:'#eee', bd:'#ddd', tx:'#333' }
  return (
    <span
      style={{
        display:'inline-block',
        padding:'6px 12px',
        borderRadius:999,
        background:st.bg,
        border:`1.5px solid ${st.bd}`,
        color:st.tx,
        fontWeight:700,
        fontSize:12,
        letterSpacing:0.3
      }}
    >
      {s || '—'}
    </span>
  )
}

export default function ClienteDetalle() {
  const { id } = useParams()
  const me = getUserFromToken()
  const puedeCrearPedido = hasRole(me, 'PRODUCCION') || hasRole(me, 'JEFE') || hasRole(me, 'ADMINISTRADOR')

  const [info, setInfo] = useState(null)

  // tabla/filtros
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const [q, setQ] = useState('')
  const [estado, setEstado] = useState('TODOS') // TODOS | PENDIENTE | EN_PROCESO | ENTREGADO | CANCELADO
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  const load = async () => {
    setLoading(true); setMsg('')
    try {
      const [summary, orders] = await Promise.all([
        fetchCustomerSummary(id),
        listOrders({
          customerId: id,
          q,
          state: estado === 'TODOS' ? undefined : estado,
          from: from || undefined,
          to: to || undefined,
          limit: pageSize,
          offset: page * pageSize
        })
      ])
      setInfo(summary)
      setRows(Array.isArray(orders) ? orders : (orders?.items || [])) // soporta ambos backends
    } catch (e) {
      console.error(e)
      setMsg('Error cargando datos de cliente')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-line */ }, [id, page, pageSize])
  const onFilter = (e) => { e.preventDefault(); setPage(0); load() }

  // KPIs (si existen en el summary; si no, caen a algo razonable)
  const kpis = useMemo(() => {
    const totalPedidos = info?.pedidosTotales ?? info?.ordersCount ?? null
    const montoAcum = info?.montoAcumulado ?? info?.totalAmount ?? null
    const ultimo = info?.ultimoPedido ?? info?.lastOrderDate ?? null
    const cumplimiento = info?.porcentajeCumplimiento ?? info?.fulfillment ?? null
    const pendientes = info?.pendientes ?? info?.pendingCount ?? null
    return {
      totalPedidos,
      montoAcum,
      ultimo,
      cumplimiento,
      pendientes
    }
  }, [info])

  return (
    <section className="card">
      {/* Cabecera cliente */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h2 style={{ margin:'0 0 4px' }}>{info?.razonSocial || info?.name || 'Cliente'}</h2>
          <div className="muted" style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <span><b>RUC:</b> {info?.RUC || info?.ruc || '—'}</span>
            {info?.contacto && <span>Contacto: {info.contacto}</span>}
            {info?.telefono && <span>· {info.telefono}</span>}
            {info?.email && <span>· {info.email}</span>}
          </div>
        </div>
        {puedeCrearPedido && (
          <Link className="btn" to={`/app/pedidos/nuevo?customerId=${info?.id}`}>+ Nuevo pedido</Link>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(180px,1fr))', gap:16, marginTop:18 }}>
        <div style={kpiCard}>
          <div className="muted">Pedidos totales</div>
          <div style={kpiNum}>{kpis.totalPedidos ?? '—'}</div>
        </div>
        <div style={kpiCard}>
          <div className="muted">Monto acumulado</div>
          <div style={kpiNum}>{kpis.montoAcum != null ? fmtMoney(kpis.montoAcum) : '—'}</div>
        </div>
        <div style={kpiCard}>
          <div className="muted">Último pedido</div>
          <div style={kpiNum}>{kpis.ultimo ? fmtDate(kpis.ultimo) : '—'}</div>
        </div>
        <div style={kpiCard}>
          <div className="muted">% cumplimiento</div>
          <div style={kpiNum}>
            {kpis.cumplimiento != null ? `${Number(kpis.cumplimiento).toFixed(0)}%` : '—'}
          </div>
          {kpis.pendientes != null && (
            <div className="muted" style={{ fontSize:12 }}>{kpis.pendientes} pendientes</div>
          )}
        </div>
      </div>

      {/* Filtros */}
      <form onSubmit={onFilter}
            style={{ display:'grid', gridTemplateColumns:'2.2fr 1fr 1fr 1fr .8fr auto', gap:10, marginTop:18 }}>
        <input
          placeholder="Por ID, fecha (AAAA-MM-DD) o total…"
          value={q}
          onChange={e=>setQ(e.target.value)}
        />
        <select value={estado} onChange={e=>setEstado(e.target.value)}>
          <option value="TODOS">Todos</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="EN_PROCESO">En proceso</option>
          <option value="ENTREGADO">Entregado</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
        <input type="date" value={from} onChange={e=>setFrom(e.target.value)} placeholder="Desde" />
        <input type="date" value={to} onChange={e=>setTo(e.target.value)} placeholder="Hasta" />
        <select value={pageSize} onChange={e=>{ setPageSize(Number(e.target.value)); setPage(0) }}>
          {[10,20,30,50].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <button className="btn-secondary">Filtrar</button>
      </form>

      {msg && <div className="muted" style={{ marginTop:8 }}>{msg}</div>}

      {/* Tabla pedidos */}
      <div className="table" style={{ marginTop:14 }}>
        <div className="table__head" style={{ gridTemplateColumns:'1fr 1.2fr 1fr 1.2fr auto' }}>
          <div>ID</div>
          <div>Fecha</div>
          <div>Total</div>
          <div>Estado</div>
          <div>Acciones</div>
        </div>

        {!loading && rows.map(o => (
          <div className="table__row" key={o.id} style={{ gridTemplateColumns:'1fr 1.2fr 1fr 1.2fr auto' }}>
            <div>#{o.id}</div>
            <div>{fmtDate(o.fecha)}</div>
            <div>{fmtMoney(o.total)}</div>
            <div><EstadoBadge state={o.estado || o.state} /></div>
            <div>
              <Link className="btn-secondary" to={`/app/pedidos/${o.id}`}>Ver</Link>
            </div>
          </div>
        ))}
        {loading && <div className="muted">Cargando…</div>}
        {!loading && rows.length === 0 && <div className="muted">Sin pedidos</div>}
      </div>

      {/* Paginación simple (sin total del backend) */}
      <div style={{ display:'flex', gap:8, marginTop:10, alignItems:'center' }}>
        <button
          className="btn-secondary"
          disabled={page===0}
          onClick={()=>setPage(p=>Math.max(0, p-1))}
        >
          Anterior
        </button>
        <div className="muted">Página {page+1}</div>
        <button
          className="btn-secondary"
          disabled={rows.length < pageSize}
          onClick={()=>setPage(p=>p+1)}
        >
          Siguiente
        </button>
      </div>
    </section>
  )
}

const kpiCard = {
  background:'#fff',
  border:'1px solid rgba(0,0,0,.08)',
  borderRadius:16,
  padding:'14px 16px',
  boxShadow:'0 2px 8px rgba(0,0,0,.04)'
}
const kpiNum = { fontSize:22, fontWeight:700, marginTop:6 }
