// frontend/src/pages/Almacen.jsx
import { useEffect, useMemo, useState } from 'react'
import { fetchPrimaryStock, fetchFinishedStock } from '../api/stock' // asegúrate que existen
// fetchPrimaryStock({ zone:'RECEPCION'|'PRODUCCION', limit, offset, q })
// fetchFinishedStock({ limit, offset, q })

function fmtKg(n) {
  const num = Number(n)
  if (!isFinite(num)) return '0.00'
  return num.toFixed(2)
}
function fmtDate(d) {
  if (!d) return '—'
  const t = new Date(d)
  return isNaN(t.getTime()) ? '—' : t.toLocaleString()
}

const TABS = [
  { key: 'ALMACEN', label: 'Almacén (PT)' },
  { key: 'RECEPCION', label: 'Recepción (MP)' },
  { key: 'PRODUCCION', label: 'Producción (MP)' },
  // { key: 'MERMA', label: 'Merma' }, // cuando integres merma aquí la activas
]

export default function Almacen() {
  const [tab, setTab] = useState('RECEPCION') // por defecto Recepción (como pediste)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = useMemo(() => (tab === 'ALMACEN' ? 30 : 30), [tab])

  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const load = async () => {
    setLoading(true); setMsg('')
    try {
      if (tab === 'ALMACEN') {
        const data = await fetchFinishedStock({ limit: pageSize, offset: page * pageSize, q: q || undefined })
        setRows(Array.isArray(data?.items) ? data.items : [])
        setTotal(Number(data?.total || 0))
      } else {
        const data = await fetchPrimaryStock({ zone: tab, limit: pageSize, offset: page * pageSize, q: q || undefined })
        setRows(Array.isArray(data?.items) ? data.items : [])
        setTotal(Number(data?.total || 0))
      }
    } catch (e) {
      console.error(e)
      setMsg('Error cargando stock')
      setRows([]); setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { setPage(0) }, [tab]) // reset paginación al cambiar pestaña
  useEffect(() => { load() }, [tab, page]) // eslint-disable-line

  const canPrev = page > 0
  const canNext = (page + 1) * pageSize < total

  return (
    <section className="card">
      <div className="topbar" style={{ gap: 8, flexWrap:'wrap' }}>
        <h3 style={{ margin: 0 }}>Almacén</h3>
        <div style={{ display:'flex', gap: 6 }}>
          {TABS.map(t => (
            <button
              key={t.key}
              className={tab === t.key ? 'btn' : 'btn-secondary'}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <form
          onSubmit={(e)=>{e.preventDefault(); setPage(0); load()}}
          style={{ display:'flex', gap:8 }}
        >
          <input placeholder="Buscar…" value={q} onChange={e=>setQ(e.target.value)} />
          <button className="btn-secondary">Filtrar</button>
        </form>
      </div>

      {msg && <div className="error" style={{ marginTop:8 }}>{msg}</div>}

      {/* Tabla */}
      <div className="table" style={{ marginTop: 12 }}>
        {/* CABECERAS */}
        {tab === 'ALMACEN' ? (
          <div className="table__head" style={{ gridTemplateColumns:'2fr 1fr 1fr' }}>
            <div>Producto</div>
            <div>Presentación</div>
            <div>Stock (kg)</div>
          </div>
        ) : (
          <div className="table__head" style={{ gridTemplateColumns:'2fr 1fr 1fr 1fr' }}>
            <div>Materia prima</div>
            <div>Denier</div>
            <div>Stock (kg)</div>
            <div>Última act.</div>
          </div>
        )}

        {/* FILAS */}
        {!loading && rows.map((r, i) => {
          if (tab === 'ALMACEN') {
            // Backend /finished: { productId, productName, presentationId, presentationKg, stockKg }
            const name = r.productName || r.DESCRIPCION || `Prod #${r.productId}`
            const pres = (r.presentationKg != null && isFinite(Number(r.presentationKg)))
              ? `${Number(r.presentationKg).toFixed(2)} kg`
              : '—'
            const stock = fmtKg(r.stockKg)
            return (
              <div className="table__row" key={`${r.productId}-${r.presentationId ?? 'NA'}-${i}`} style={{ gridTemplateColumns:'2fr 1fr 1fr' }}>
                <div>{name}</div>
                <div>{pres}</div>
                <div>{stock}</div>
              </div>
            )
          } else {
            // Backend /primary: { primaterId, material, color, descripcion, denier, stockKg, lastUpdate }
            const title = [r.material, r.color].filter(Boolean).join(' / ') || `MP #${r.primaterId}`
            const denier = (r.denier != null && isFinite(Number(r.denier))) ? String(r.denier) : 'Sin denier'
            const stock = fmtKg(r.stockKg)
            const last = fmtDate(r.lastUpdate)
            return (
              <div className="table__row" key={`${r.primaterId}-${i}`} style={{ gridTemplateColumns:'2fr 1fr 1fr 1fr' }}>
                <div>
                  <div>{title}</div>
                  <div className="muted">{r.descripcion || ''}</div>
                </div>
                <div>{denier}</div>
                <div>{stock}</div>
                <div>{last}</div>
              </div>
            )
          }
        })}

        {loading && <div className="muted">Cargando…</div>}
        {!loading && rows.length === 0 && <div className="muted">Sin resultados</div>}
      </div>

      {/* Paginación */}
      <div style={{ display:'flex', gap:8, marginTop:10, alignItems:'center' }}>
        <button className="btn-secondary" disabled={!canPrev} onClick={()=>setPage(p=>Math.max(0, p-1))}>Anterior</button>
        <div className="muted">
          Página {page+1} de {Math.max(1, Math.ceil(total / pageSize))}
        </div>
        <button className="btn-secondary" disabled={!canNext} onClick={()=>setPage(p=>p+1)}>Siguiente</button>
      </div>
    </section>
  )
}
