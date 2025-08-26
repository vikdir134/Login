// src/pages/PedidosProceso.jsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listOrdersCombined } from '../api/orders'

export default function PedidosProceso() {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 30

  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const navigate = useNavigate()

  const load = async () => {
    setLoading(true); setMsg('')
    try {
      const data = await listOrdersCombined({
        q,
        state: 'PENDIENTE,EN_PROCESO',
        limit: pageSize,
        offset: page * pageSize
      })
      setRows(Array.isArray(data?.items) ? data.items : [])
      setTotal(Number(data?.total || 0))
    } catch (e) {
      console.error(e)
      setMsg('Error cargando pedidos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-line */ }, [page])

  const onSearch = (e) => { e.preventDefault(); setPage(0); load() }

  const canPrev = page > 0
  const canNext = (page + 1) * pageSize < total
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((total || 0) / pageSize)),
    [total]
  )

  const badgeClass = (state) =>
    state === 'EN_PROCESO' ? 'badge badge--warning'
    : state === 'PENDIENTE' ? 'badge badge--danger'
    : 'badge'

  return (
    <section className="card">
      <div className="topbar" style={{ marginBottom: 0 }}>
        <h3 style={{ margin: 0 }}>Pedidos activos (pendientes + en proceso)</h3>
      </div>

      <form onSubmit={onSearch} style={{ display: 'grid', gridTemplateColumns: '2fr auto', gap: 8, marginTop: 12 }}>
        <input placeholder="Buscar (cliente/producto)" value={q} onChange={e => setQ(e.target.value)} />
        <button className="btn-secondary">Filtrar</button>
      </form>

      {msg && <div className="muted" style={{ marginTop: 8 }}>{msg}</div>}

      <div className="table" style={{ marginTop: 14 }}>
        <div className="table__head" style={{ gridTemplateColumns: '1fr 2fr 1fr auto' }}>
          <div>Fecha</div>
          <div>Cliente</div>
          <div>Estado</div>
          <div>Acciones</div>
        </div>

        {!loading && rows.map(r => (
          <div className="table__row" key={r.id} style={{ gridTemplateColumns: '1fr 2fr 1fr auto' }}>
            <div>{new Date(r.fecha).toLocaleString()}</div>
            <div>{r.customerName}</div>
            <div><span className={badgeClass(r.state)}>{r.state}</span></div>
            <div>
              <button className="btn" onClick={() => navigate(`/app/entregas/orden/${r.id}`)}>
                Elegir
              </button>
            </div>
          </div>
        ))}

        {loading && <div className="muted">Cargando…</div>}
        {!loading && rows.length === 0 && <div className="muted">No hay pedidos</div>}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
        <button
          className="btn-secondary"
          disabled={!canPrev}
          onClick={() => setPage(p => Math.max(0, p - 1))}
        >
          Anterior
        </button>

        <div className="muted">Página {page + 1} de {totalPages}</div>

        <button
          className="btn-secondary"
          disabled={!canNext}
          onClick={() => setPage(p => p + 1)}
        >
          Siguiente
        </button>
      </div>
    </section>
  )
}
