// frontend/src/pages/Almacen.jsx
import { useEffect, useMemo, useState } from 'react'
import { fetchPrimaryStock, fetchFinishedStock, fetchMerma } from '../api/stock'
import { getUserFromToken, hasRole } from '../utils/auth'
import AddPTModal from '../components/AddPTModal'
import MoveMPModal from '../components/MoveMPModal'
import AddMermaModal from '../components/AddMermaModal'
import ExtrasModal from '../components/ExtrasModal'
const fmtKg = (v) => (Number.isFinite(Number(v)) ? Number(v).toFixed(2) : '0.00')
const fmtDate = (s) => s ? new Date(s).toLocaleString() : '—'

const TABS = [
  { key: 'ALMACEN',   label: 'Almacén (PT)' },
  { key: 'RECEPCION', label: 'Recepción (MP)' },
  { key: 'PRODUCCION',label: 'Producción (MP)' },
  { key: 'MERMA',     label: 'Merma' }
]

export default function Almacen() {
  const me = getUserFromToken()
  const puedePT      = hasRole(me,'JEFE') || hasRole(me,'ADMINISTRADOR') || hasRole(me,'PRODUCCION')
  const puedeMoverMP = hasRole(me,'JEFE') || hasRole(me,'ADMINISTRADOR') || hasRole(me,'ALMACENERO') || hasRole(me,'PRODUCCION')
  const puedeMerma   = hasRole(me,'JEFE') || hasRole(me,'ADMINISTRADOR') || hasRole(me,'ALMACENERO') || hasRole(me,'PRODUCCION')

  const [tab, setTab] = useState('ALMACEN')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 30

  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  // modales
  const [openPT, setOpenPT] = useState(false)
  const [openMove, setOpenMove] = useState(false)
  const [openMerma, setOpenMerma] = useState(false)
  const [openExtras, setOpenExtras] = useState(false)
  // ID de zona de PT almacén (ajústalo si varía)
  const PT_ALMACEN_ID = 18

  const load = async () => {
    setLoading(true); setMsg('')
    try {
      if (tab === 'ALMACEN') {
        const data = await fetchFinishedStock({ q, limit: pageSize, offset: page * pageSize })
        setRows(Array.isArray(data.items) ? data.items : [])
        setTotal(Number(data.total || 0))
      } else if (tab === 'MERMA') {
        const data = await fetchMerma({ q, limit: pageSize, offset: page * pageSize })
        setRows(Array.isArray(data.items) ? data.items : [])
        setTotal(Number(data.total || 0))
      } else {
        const data = await fetchPrimaryStock({ zone: tab, q, limit: pageSize, offset: page * pageSize })
        setRows(Array.isArray(data.items) ? data.items : [])
        setTotal(Number(data.total || 0))
      }
    } catch (e) {
      console.error(e)
      setMsg('Error cargando stock')
      setRows([]); setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { setPage(0) }, [tab])
  useEffect(() => { load() /* eslint-disable-line */ }, [tab, page])

  const totalPages = useMemo(() => Math.max(1, Math.ceil((total||0) / pageSize)), [total])
  const canPrev = page > 0
  const canNext = (page + 1) * pageSize < total
  const onSearch = (e) => { e.preventDefault(); setPage(0); load() }

  // Decide origen por pestaña para el modal mover MP
  const defaultFromForMove = tab === 'RECEPCION' ? 'RECEPCION' : 'PRODUCCION'

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
        <form onSubmit={onSearch} style={{ display:'flex', gap:8 }}>
          <input placeholder="Buscar…" value={q} onChange={e=>setQ(e.target.value)} />
          <button className="btn-secondary">Filtrar</button>
        </form>
        {/* Acciones contextuales */}
        {tab === 'ALMACEN' && (
          <>
            {puedePT && <button className="btn" onClick={()=>setOpenPT(true)}>+ Producto Terminado</button>}
            <button className="btn-secondary" onClick={()=>setOpenExtras(true)}>Extras</button>
          </>
        )}

        {(tab === 'RECEPCION' || tab === 'PRODUCCION') && puedeMoverMP && (
          <button className="btn-secondary" onClick={()=>setOpenMove(true)}>Mover MP</button>
        )}
        {tab === 'MERMA' && puedeMerma && (
          <button className="btn-secondary" onClick={()=>setOpenMerma(true)}>+ Merma</button>
        )}
      </div>

      {msg && <div className="muted" style={{ marginTop:8 }}>{msg}</div>}

      {/* Tabla */}
      <div className="table" style={{ marginTop: 12 }}>
        {tab === 'ALMACEN' && (
          <>
            <div className="table__head" style={{ gridTemplateColumns:'2fr 1fr 1fr' }}>
              <div>Producto</div>
              <div>Presentación</div>
              <div>Stock (kg)</div>
            </div>
            {!loading && rows.map((r, i) => (
              <div className="table__row" key={`${r.productId}-${r.presentationId ?? 'NA'}-${i}`} style={{ gridTemplateColumns:'2fr 1fr 1fr' }}>
                <div>{r.productName || r.DESCRIPCION || `Producto #${r.productId}`}</div>
                <div>{r.presentationKg ? `${fmtKg(r.presentationKg)} kg` : '—'}</div>
                <div>{fmtKg(r.stockKg)}</div>
              </div>
            ))}
          </>
        )}

        {(tab === 'RECEPCION' || tab === 'PRODUCCION') && (
          <>
            <div className="table__head" style={{ gridTemplateColumns:'2fr 1.2fr 1fr 1fr' }}>
              <div>Materia prima</div>
              <div>Color / Denier</div>
              <div>Stock (kg)</div>
              <div>Última act.</div>
            </div>
            {!loading && rows.map((r, i) => (
              <div className="table__row" key={`${r.primaterId}-${i}`} style={{ gridTemplateColumns:'2fr 1.2fr 1fr 1fr' }}>
                <div>
                  <div>{[r.material, r.descripcion].filter(Boolean).join(' · ')}</div>
                </div>
                <div>{(r.color || '—') + ' / ' + (r.denier != null ? r.denier : 'Sin denier')}</div>
                <div>{fmtKg(r.stockKg)}</div>
                <div>{fmtDate(r.lastUpdate)}</div>
              </div>
            ))}
          </>
        )}

        {tab === 'MERMA' && (
          <>
            <div className="table__head" style={{ gridTemplateColumns:'1fr 2fr 1fr 1fr' }}>
              <div>Tipo</div>
              <div>Ítem</div>
              <div>Merma (kg)</div>
              <div>Última act.</div>
            </div>
            {!loading && rows.map((r, i) => (
              <div className="table__row" key={`${r.id || i}`} style={{ gridTemplateColumns:'1fr 2fr 1fr 1fr' }}>
                <div>{r.type || r.TIPO || '—'}</div>
                <div>{r.name || r.itemName || r.DESCRIPCION || '—'}</div>
                <div>{fmtKg(r.stockKg || r.peso || r.MERMA)}</div>
                <div>{fmtDate(r.lastUpdate)}</div>
              </div>
            ))}
          </>
        )}

        {loading && <div className="muted">Cargando…</div>}
        {!loading && rows.length === 0 && <div className="muted">Sin resultados</div>}
      </div>

      {/* Paginación */}
      <div style={{ display:'flex', gap:8, marginTop:10, alignItems:'center' }}>
        <button className="btn-secondary" disabled={!canPrev} onClick={()=>setPage(p=>Math.max(0, p-1))}>Anterior</button>
        <div className="muted">Página {page+1} de {totalPages}</div>
        <button className="btn-secondary" disabled={!canNext} onClick={()=>setPage(p=>p+1)}>Siguiente</button>
      </div>

      {/* Modales */}
      <AddPTModal
        open={openPT}
        onClose={()=>setOpenPT(false)}
        defaultZoneId={PT_ALMACEN_ID}
        onDone={load}
      />
      <MoveMPModal
        open={openMove}
        onClose={()=>setOpenMove(false)}
        onDone={load}
        defaultFrom={defaultFromForMove}
      />
      <AddMermaModal
        open={openMerma}
        onClose={()=>setOpenMerma(false)}
        onDone={load}
      />
      <ExtrasModal open={openExtras} onClose={()=>setOpenExtras(false)} />
    </section>
  )
}
