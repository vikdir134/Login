import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listDeliveries } from '../api/deliveries'
import { hasRole, getUserFromToken } from '../utils/auth'

const fmtKg = n => (Number(n)||0).toFixed(2)

export default function Entregas() {
  const me = getUserFromToken()
  const puedeCrear = hasRole(me,'PRODUCCION') || hasRole(me,'JEFE') || hasRole(me,'ADMINISTRADOR')

  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
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
      const data = await listDeliveries({ q, from, to, limit: pageSize, offset: page*pageSize })
      setRows(Array.isArray(data?.items) ? data.items : [])
      setTotal(Number(data?.total || 0))
    } catch (e) {
      console.error(e); setMsg('Error cargando entregas')
    } finally { setLoading(false) }
  }

  useEffect(()=>{ load() /* eslint-disable-line */ }, [page])
  const onSearch = (e)=>{ e.preventDefault(); setPage(0); load() }

  const canPrev = page>0
  const canNext = (page+1)*pageSize < total
  const totalPages = useMemo(()=> Math.max(1, Math.ceil((total||0)/pageSize)), [total])

  return (
    <section className="card">
      <div className="topbar" style={{ marginBottom:0 }}>
        <h3 style={{ margin:0 }}>Entregas</h3>
        <div style={{ flex:1 }} />
        {puedeCrear && (
          <button className="btn" onClick={()=> navigate('/app/entregas/nueva')}>
            + Nueva entrega
          </button>
        )}
      </div>

      <form onSubmit={onSearch} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr auto', gap:8, marginTop:12 }}>
        <input placeholder="Buscar (cliente/estado/producto)" value={q} onChange={e=>setQ(e.target.value)} />
        <input type="date" value={from} onChange={e=>setFrom(e.target.value)} />
        <input type="date" value={to} onChange={e=>setTo(e.target.value)} />
        <button className="btn-secondary">Filtrar</button>
      </form>

      {msg && <div className="muted" style={{marginTop:8}}>{msg}</div>}

      <div className="table" style={{ marginTop:14 }}>
        <div className="table__head" style={{ gridTemplateColumns:'1fr 2fr 1fr 1fr 1fr auto' }}>
          <div>Fecha</div>
          <div>Cliente</div>
          <div>Estado pedido</div>
          <div>Peso total</div>
          <div>Subtotal</div>
          <div>Acciones</div>
        </div>
        {!loading && rows.map((r,i)=>(
          <div className="table__row" key={r.deliveryId || i} style={{ gridTemplateColumns:'1fr 2fr 1fr 1fr 1fr auto' }}>
            <div>{new Date(r.fecha).toLocaleString()}</div>
            <div>{r.customerName}</div>
            <div><span className="badge">{r.orderState}</span></div>
            <div>{fmtKg(r.pesoTotal)} kg</div>
            <div>{(Number(r.subtotalTotal)||0).toFixed(2)} {r.currency || ''}</div>
            <div>
              <Link className="btn-secondary" to={`/app/entregas/orden/${r.orderId}`}>Ver pedido</Link>
            </div>
          </div>
        ))}
        {loading && <div className="muted">Cargando…</div>}
        {!loading && rows.length===0 && <div className="muted">Sin resultados</div>}
      </div>

      <div style={{ display:'flex', gap:8, marginTop:10, alignItems:'center' }}>
        <button className="btn-secondary" disabled={!canPrev} onClick={()=>setPage(p=>Math.max(0,p-1))}>Anterior</button>
        <div className="muted">Página {page+1} de {totalPages}</div>
        <button className="btn-secondary" disabled={!canNext} onClick={()=>setPage(p=>p+1)}>Siguiente</button>
      </div>
    </section>
  )
}
