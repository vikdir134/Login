import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchCustomers } from '../api/customers'
import { hasRole, getUserFromToken } from '../utils/auth'

export default function Clientes() {
  const me = getUserFromToken()
  const puedeCrear = hasRole(me, 'JEFE') || hasRole(me, 'ADMINISTRADOR')

  const [q, setQ] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchCustomers({ q })
      .then(data => { if (alive) setRows(data) })
      .catch(() => { if (alive) setMsg('Error cargando clientes') })
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [q])

  return (
    <section className="card">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h3 style={{ margin:0 }}>Clientes</h3>
        {puedeCrear && <Link className="btn" to="/app/clientes/nuevo">+ Nuevo</Link>}
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
          <div className="table__head">
            <div>RUC</div>
            <div>Razón social</div>
            <div>Estado</div>
            <div>Acciones</div>
          </div>
          {rows.map(r => (
            <div className="table__row" key={r.id}>
              <div>{r.RUC}</div>
              <div>{r.razonSocial}</div>
              <div>{r.activo ? 'Activo' : 'Inactivo'}</div>
              <div><Link className="btn-secondary" to={`/app/clientes/${r.id}`}>Ver</Link></div>
            </div>
          ))}
          {rows.length === 0 && <div className="muted">Sin resultados</div>}
        </div>
      )}

      {msg && <div className="muted" style={{ marginTop:8 }}>{msg}</div>}
    </section>
  )
}
