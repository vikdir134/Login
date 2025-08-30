import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchCustomers } from '../api/customers'
import { hasRole, getUserFromToken } from '../utils/auth'
import AddCustomerModal from '../components/AddCustomerModal'

export default function Clientes() {
  const me = getUserFromToken()
  const puedeCrear = hasRole(me, 'JEFE') || hasRole(me, 'ADMINISTRADOR')

  const [q, setQ] = useState('')
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const [openNew, setOpenNew] = useState(false)

  // Paginación
  const [page, setPage] = useState(0)
  const pageSize = 30

  const canPrev = page > 0
  const canNext = (page + 1) * pageSize < total
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((total || 0) / pageSize)),
    [total]
  )

  const load = async () => {
    setLoading(true); setMsg('')
    try {
      const data = await fetchCustomers({
        q,
        limit: pageSize,
        offset: page * pageSize
      })

      // Soporta dos formatos de respuesta:
      // 1) Array simple
      // 2) { items, total }
      if (Array.isArray(data)) {
        setRows(data)
        setTotal(data.length < pageSize && page === 0 ? data.length : (page + 1) * pageSize + (data.length === pageSize ? pageSize : 0)) // fallback
      } else {
        setRows(Array.isArray(data?.items) ? data.items : [])
        setTotal(Number(data?.total || 0))
      }
    } catch {
      setMsg('Error cargando clientes')
      setRows([]); setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  // Buscar y paginar
  useEffect(() => { setPage(0) }, [q])           // reset de página al cambiar búsqueda
  useEffect(() => { load() }, [q, page])         // carga por q y page

  return (
    <section className="card">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h3 style={{ margin:0 }}>Clientes</h3>
        {puedeCrear && (
          <button className="btn" onClick={()=>setOpenNew(true)}>+ Nuevo</button>
        )}
      </div>

      <div style={{ margin:'12px 0' }}>
        <input
          placeholder="Buscar por RUC o Razón social…"
          value={q}
          onChange={e=>setQ(e.target.value)}
          style={{ width:'100%' }}
        />
      </div>

      {loading ? 'Cargando…' : (
        <div className="table">
          <div className="table__head" style={{ gridTemplateColumns:'1fr 2fr 1fr auto' }}>
            <div>RUC</div>
            <div>Razón social</div>
            <div>Estado</div>
            <div>Acciones</div>
          </div>
          {rows.map(r => (
            <div className="table__row" key={r.id} style={{ gridTemplateColumns:'1fr 2fr 1fr auto' }}>
              <div>{r.RUC}</div>
              <div>{r.razonSocial}</div>
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    borderRadius: '10px',
                    border: `2px solid ${r.activo ? 'var(--success)' : 'var(--danger)'}`,
                    color: r.activo ? 'var(--success)' : 'var(--danger)',
                    fontWeight: 700
                  }}
                >
                  {r.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <div><Link className="btn-secondary" to={`/app/clientes/${r.id}`}>Ver</Link></div>
            </div>
          ))}
          {rows.length === 0 && <div className="muted">Sin resultados</div>}
        </div>
      )}

      {/* Paginación */}
      <div style={{ display:'flex', gap:8, marginTop:10, alignItems:'center' }}>
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

      {msg && <div className="muted" style={{ marginTop:8 }}>{msg}</div>}

      <AddCustomerModal
        open={openNew}
        onClose={()=>setOpenNew(false)}
        onSuccess={load}
      />
    </section>
  )
}
