// frontend/src/pages/CuentasPorCobrar.jsx
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listReceivableCustomers, fetchReceivablesSummary } from '../api/receivables'

const fmt = n => (Number(n)||0).toFixed(2)

// pequeño hook de debounce local (sin libs)
function useDebounced(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function CuentasPorCobrar() {
  // búsqueda y filtro
  const [q, setQ] = useState('')
  const qDebounced = useDebounced(q, 400)         // ← búsqueda reactiva
  const [balance, setBalance] = useState('all')   // 'all' | 'with' | 'without'

  // paginado
  const [page, setPage] = useState(0)
  const pageSize = 30

  // data
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState(null)

  // ui
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const load = async ({ resetPage = false } = {}) => {
    setLoading(true); setMsg('')
    try {
      const p = resetPage ? 0 : page
      const [list, sum] = await Promise.all([
        listReceivableCustomers({
          q: qDebounced || undefined,
          balance,                          // ← backend filtra aquí
          limit: pageSize,
          offset: p * pageSize
        }),
        fetchReceivablesSummary()
      ])
      setRows(Array.isArray(list?.items) ? list.items : [])
      setTotal(Number(list?.total || 0))
      setSummary(sum || null)
      if (resetPage) setPage(0)
    } catch (e) {
      console.error(e)
      setMsg('Error cargando cuentas por cobrar')
    } finally {
      setLoading(false)
    }
  }

  // 1) carga inicial y cuando cambia la página
  useEffect(() => { load() /* eslint-disable-line */ }, [page])

  // 2) búsqueda reactiva y filtro por balance → resetea a página 0
  useEffect(() => { load({ resetPage: true }) /* eslint-disable-line */ }, [qDebounced, balance])

  const canPrev = page > 0
  const canNext = (page + 1) * pageSize < total
  const totalPages = useMemo(() => Math.max(1, Math.ceil((total || 0) / pageSize)), [total])

  // KPIs del resumen global (con IGV)
  const kpiTotal  = Number(summary?.totalPedidosPEN || 0)
  const kpiPagado = Number(summary?.totalPagadoPEN || 0)
  const kpiSaldo  = Number(summary?.saldoPEN ?? Math.max(0, kpiTotal - kpiPagado))

  return (
    <section className="card">
      <div className="topbar" style={{ marginBottom: 0 }}>
        <h3 style={{ margin:0 }}>Cuentas por cobrar</h3>
      </div>

      {/* KPIs */}
      <div style={{
        display:'grid',
        gridTemplateColumns:'repeat(3, minmax(0, 1fr))',
        gap:12,
        marginTop:12
      }}>
        <div className="card" style={{ padding:16 }}>
          <div className="muted">Total (con IGV)</div>
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

      {/* Filtros (búsqueda reactiva + selector balance) */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:8, marginTop:12, alignItems:'center' }}>
        <input
          placeholder="Buscar cliente (RUC/razón)…"
          value={q}
          onChange={e=>setQ(e.target.value)}
        />
        <select
          value={balance}
          onChange={e=>setBalance(e.target.value)}
          title="Filtrar por saldo"
        >
          <option value="all">Todos</option>
          <option value="with">Con saldo</option>
          <option value="without">Sin saldo</option>
        </select>
      </div>

      {msg && <div className="muted" style={{ marginTop:8 }}>{msg}</div>}

      {/* Tabla */}
      <div className="table" style={{ marginTop:14 }}>
        <div className="table__head" style={{ gridTemplateColumns:'2fr 1fr 1fr 1fr auto' }}>
          <div>Cliente</div>
          <div>Total (S/)</div>
          <div>Pagado (S/)</div>
          <div>Saldo (S/)</div>
          <div>Acciones</div>
        </div>

        {!loading && rows.map((r, i) => {
          const totalCli  = Number(r.totalPedidosPEN || 0)
          const pagadoCli = Number(r.totalPagadoPEN || 0)
          const saldoCli  = Number(r.saldoPEN ?? Math.max(0, totalCli - pagadoCli))
          return (
            <div
              className="table__row"
              key={r.customerId || i}
              style={{ gridTemplateColumns:'2fr 1fr 1fr 1fr auto' }}
            >
              <div>{r.customerName} · {r.RUC}</div>
              <div>{fmt(totalCli)}</div>
              <div>{fmt(pagadoCli)}</div>
              <div><b>{fmt(saldoCli)}</b></div>
              <div>
                <Link className="btn-secondary" to={`/app/cxc/${r.customerId}`}>Ver detalle</Link>
              </div>
            </div>
          )
        })}

        {loading && <div className="muted">Cargando…</div>}
        {!loading && rows.length===0 && <div className="muted">Sin resultados</div>}
      </div>

      {/* Paginación */}
      <div style={{ display:'flex', gap:8, marginTop:10, alignItems:'center' }}>
        <button className="btn-secondary" disabled={!canPrev} onClick={()=>setPage(p=>Math.max(0,p-1))}>Anterior</button>
        <div className="muted">Página {page+1} de {totalPages}</div>
        <button className="btn-secondary" disabled={!canNext} onClick={()=>setPage(p=>p+1)}>Siguiente</button>
      </div>
    </section>
  )
}
