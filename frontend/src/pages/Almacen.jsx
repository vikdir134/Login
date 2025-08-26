// frontend/src/pages/Almacen.jsx
import { useEffect, useMemo, useState } from 'react'
import {
  fetchPrimaryStock,
  fetchFinishedSummary,
  fetchFinishedByProduct,
  fetchMerma,
  deleteMerma
} from '../api/stock'
import api from '../api/axios'
import { getUserFromToken, hasRole } from '../utils/auth'
import AddPTModal from '../components/AddPTModal'
import MoveMPModal from '../components/MoveMPModal'
import AddMermaModal from '../components/AddMermaModal'
import ExtrasModal from '../components/ExtrasModal'
import RemoveMermaModal from '../components/RemoveMermaModal'
import CreatePrimaryMaterialModal from '../components/CreatePrimaryMaterialModal'
import CreateProductModal from '../components/CreateProductModal'
import CompositionModal from '../components/CompositionModal'

const fmtKg   = (v) => (Number.isFinite(Number(v)) ? Number(v).toFixed(2) : '0.00')
const fmtDate = (s) => (s ? new Date(s).toLocaleString() : '—')

const TABS = [
  { key: 'ALMACEN',   label: 'Almacén (PT)' },
  { key: 'RECEPCION', label: 'Recepción (MP)' },
  { key: 'PRODUCCION',label: 'Producción (MP)' },
  { key: 'MERMA',     label: 'Merma' }
]

/** Modal para elegir producto SIN composición (usa endpoint dedicado) */
function PickProductForCompModal({ open, onClose, onPicked }) {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true); setMsg('')
    ;(async () => {
      try {
        const r = await api.get('/api/products/without-composition') // <-- SOLO sin composición
        if (!alive) return
        const rows = Array.isArray(r.data) ? r.data : []
        setItems(rows)
        if (rows.length === 0) setMsg('Todos los productos tienen composición.')
      } catch (e) {
        if (!alive) return
        setItems([])
        setMsg(e.response?.data?.error || 'No se pudo obtener la lista de productos sin composición')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [open])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return items
    return items.filter(p =>
      String(p.name || p.DESCRIPCION || '').toLowerCase().includes(term)
    )
  }, [items, q])

  if (!open) return null
  return (
    <div className="modal modal--center">
      <div className="modal__card" style={{ minWidth: 520 }}>
        <div className="modal__header">
          <h4 style={{ margin:0 }}>Elegir producto (sin composición)</h4>
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>

        <div className="form-col" style={{ gap: 10 }}>
          <form onSubmit={(e)=>e.preventDefault()} style={{ display:'flex', gap:8 }}>
            <input
              placeholder="Buscar producto…"
              value={q}
              onChange={e=>setQ(e.target.value)}
              style={{ flex:1 }}
            />
            <button className="btn-secondary" onClick={()=>setQ(q.trim())}>Filtrar</button>
          </form>

          {loading ? (
            <div className="muted">Cargando…</div>
          ) : (
            <>
              {msg && <div className="muted">{msg}</div>}
              <div className="table" style={{ maxHeight: 360, overflow:'auto' }}>
                <div className="table__head" style={{ gridTemplateColumns:'2fr auto' }}>
                  <div>Producto</div>
                  <div>Acciones</div>
                </div>
                {filtered.map(p => {
                  const id = p.id || p.ID_PRODUCT
                  const name = p.name || p.DESCRIPCION || `Producto #${id}`
                  return (
                    <div key={id} className="table__row" style={{ gridTemplateColumns:'2fr auto' }}>
                      <div>{name}</div>
                      <div>
                        <button className="btn" onClick={()=>onPicked?.(id)}>
                          Elegir
                        </button>
                      </div>
                    </div>
                  )
                })}
                {filtered.length === 0 && (
                  <div className="muted">Sin resultados</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

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

  // PT expand
  const [expandedPT, setExpandedPT] = useState(null)
  const [ptDetailLoading, setPtDetailLoading] = useState(false)
  const [ptDetailRows, setPtDetailRows] = useState([])

  // modales
  const [openPT, setOpenPT] = useState(false)
  const [openMove, setOpenMove] = useState(false)
  const [openMerma, setOpenMerma] = useState(false)
  const [openExtras, setOpenExtras] = useState(false)
  const [openRemoveMerma, setOpenRemoveMerma] = useState(false)
  const [rowToRemove, setRowToRemove] = useState(null)
  const [openCreateMP, setOpenCreateMP] = useState(false)
  const [openCreatePT, setOpenCreatePT] = useState(false)

  // composición (nuevo flujo)
  const [openComp, setOpenComp] = useState(false)
  const [productForComp, setProductForComp] = useState(null)
  const [openPickComp, setOpenPickComp] = useState(false)

  const PT_ALMACEN_ID = 18
  const defaultFromForMove = tab === 'RECEPCION' ? 'RECEPCION' : 'PRODUCCION'

  const load = async () => {
    setLoading(true); setMsg('')
    try {
      if (tab === 'ALMACEN') {
        const data = await fetchFinishedSummary({ q, limit: pageSize, offset: page * pageSize })
        setRows(Array.isArray(data?.items) ? data.items : [])
        setTotal(Number(data?.total || 0))
      } else if (tab === 'MERMA') {
        const data = await fetchMerma({ q, limit: pageSize, offset: page * pageSize })
        setRows(Array.isArray(data?.items) ? data.items : [])
        setTotal(Number(data?.total || 0))
      } else {
        const data = await fetchPrimaryStock({ zone: tab, q, limit: pageSize, offset: page * pageSize })
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

  useEffect(() => { setPage(0); setExpandedPT(null); setPtDetailRows([]) }, [tab])
  useEffect(() => { load() /* eslint-disable-line */ }, [tab, page])

  const canPrev = page > 0
  const canNext = (page + 1) * pageSize < total
  const onSearch = (e) => { e.preventDefault(); setPage(0); setExpandedPT(null); setPtDetailRows([]); load() }

  const togglePTDetail = async (productId) => {
    if (expandedPT === productId) {
      setExpandedPT(null)
      setPtDetailRows([])
      return
    }
    setExpandedPT(productId)
    setPtDetailRows([])
    setPtDetailLoading(true)
    try {
      const det = await fetchFinishedByProduct(productId)
      setPtDetailRows(Array.isArray(det) ? det : [])
      // Nota: ya no ponemos "Componer" por fila
    } catch (e) {
      console.error(e)
      setPtDetailRows([])
    } finally {
      setPtDetailLoading(false)
    }
  }

  const onDeleteMerma = async (row) => {
    const id = row.id || row.ID || row.rowId || row.ID_STOCK_ZONE
    if (!id) { setMsg('No se puede borrar: faltan datos'); return }
    if (!confirm('¿Eliminar este registro de merma?')) return
    try {
      await deleteMerma(id)
      setMsg('✅ Merma eliminada')
      load()
    } catch (e) {
      console.error(e)
      setMsg(e.response?.data?.error || 'Error eliminando merma')
    }
  }

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

        {/* Buscador NO reactivo */}
        <form onSubmit={onSearch} style={{ display:'flex', gap:8 }}>
          <input placeholder="Buscar…" value={q} onChange={e=>setQ(e.target.value)} />
          <button className="btn-secondary">Filtrar</button>
        </form>

        {/* Acciones contextuales */}
        {tab === 'ALMACEN' && (
          <>
            {puedePT && <button className="btn" onClick={()=>setOpenPT(true)}>+ Producto Terminado</button>}
            <button className="btn-secondary" onClick={()=>setOpenCreateMP(true)}>Crear MP</button>
            <button className="btn-secondary" onClick={()=>setOpenCreatePT(true)}>Crear PT</button>
            <button
              className="btn-secondary"
              onClick={()=>setOpenPickComp(true)}
              title="Definir composición para productos que aún no la tienen"
            >
              Composición
            </button>
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
        {/* ====== ALMACÉN (PT) — Resumen + expandible ====== */}
        {tab === 'ALMACEN' && (
          <>
            <div className="table__head" style={{ gridTemplateColumns:'2fr 1fr auto' }}>
              <div>Producto</div>
              <div>Total (kg)</div>
              <div>Acciones</div>
            </div>

            {!loading && rows.map((r, i) => {
              const pid = r.productId
              const open = expandedPT === pid
              return (
                <div key={`${pid}-${i}`} style={{ display:'contents' }}>
                  <div className="table__row" style={{ gridTemplateColumns:'2fr 1fr auto' }}>
                    <div>{r.productName}</div>
                    <div>{fmtKg(r.stockKg)}</div>
                    <div>
                      <button className="btn-secondary" onClick={() => togglePTDetail(pid)}>
                        {open ? 'Ocultar' : 'Ver'}
                      </button>
                    </div>
                  </div>

                  {open && (
                    <div className="table__row" style={{ gridColumn:'1 / -1', background:'var(--bg-soft)' }}>
                      {ptDetailLoading ? (
                        <div className="muted">Cargando presentaciones…</div>
                      ) : (
                        <div style={{ width:'100%' }}>
                          <div className="muted" style={{ marginBottom:8 }}>
                            Presentaciones de <strong>{r.productName}</strong>
                          </div>

                          <div className="table">
                            <div className="table__head" style={{ gridTemplateColumns:'2fr 1fr' }}>
                              <div>Presentación</div>
                              <div>Stock (kg)</div>
                            </div>

                             {ptDetailRows.map((p, idx) => (
                              <div
                                className="table__row"
                                key={`${pid}-${(p.presentacion ?? 'NULL')}-${idx}`}
                                style={{ gridTemplateColumns:'2fr 1fr' }}
                              >
                                {/* backend ahora manda `presentacion` (texto) */}
                                <div>{p.presentacion ?? '—'} Kg</div>
                                <div>{fmtKg(p.stockKg)} Kg</div>
                              </div>
                            ))}

                            {ptDetailRows.length === 0 && (
                              <div className="muted">Sin presentaciones con stock</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )
            })}
          </>
        )}

        {/* ====== MP (Recepción / Producción) ====== */}
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

        {/* ====== MERMA ====== */}
        {tab === 'MERMA' && (
          <>
            <div className="table__head" style={{ gridTemplateColumns:'1fr 2fr 1fr 1fr auto' }}>
              <div>Tipo</div>
              <div>Ítem</div>
              <div>Merma (kg)</div>
              <div>Última act.</div>
              <div>Acciones</div>
            </div>
            {!loading && rows.map((r, i) => (
              <div className="table__row" key={`${r.id || r.rowId || i}`} style={{ gridTemplateColumns:'1fr 2fr 1fr 1fr auto' }}>
                <div>{r.type || r.TIPO || '—'}</div>
                <div>{r.name || r.itemName || r.DESCRIPCION || '—'}</div>
                <div>{fmtKg(r.stockKg || r.peso || r.MERMA)}</div>
                <div>{fmtDate(r.lastUpdate)}</div>
                <div>
                  <button
                    className="btn-secondary"
                    onClick={() => { setRowToRemove(r); setOpenRemoveMerma(true) }}
                  >
                    Eliminar
                  </button>
                </div>
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
        <div className="muted">Página {page+1} de {Math.max(1, Math.ceil((total||0)/pageSize))}</div>
        <button className="btn-secondary" disabled={!canNext} onClick={()=>setPage(p=>p+1)}>Siguiente</button>
      </div>

      {/* Modales */}
      <AddPTModal
        open={openPT}
        onClose={()=>setOpenPT(false)}
        defaultZoneId={PT_ALMACEN_ID}
        onDone={()=>{ setExpandedPT(null); setPtDetailRows([]); load() }}
      />
      <MoveMPModal
        open={openMove}
        onClose={()=>setOpenMove(false)}
        onDone={load}
        defaultFrom={defaultFromForMove}
      />
      <AddMermaModal open={openMerma} onClose={()=>setOpenMerma(false)} onDone={load} />
      <ExtrasModal open={openExtras} onClose={()=>setOpenExtras(false)} />
      <RemoveMermaModal
        open={openRemoveMerma}
        onClose={()=>{ setOpenRemoveMerma(false); setRowToRemove(null) }}
        row={rowToRemove}
        onDone={load}
      />

      <CreatePrimaryMaterialModal
        open={openCreateMP}
        onClose={()=>setOpenCreateMP(false)}
        onDone={()=>{ if (tab !== 'ALMACEN') load() }}
      />

      <CreateProductModal
        open={openCreatePT}
        onClose={()=>setOpenCreatePT(false)}
        onDone={()=>{ /* opcional: recargar productos */ }}
      />

      {/* Selector de producto SIN composición */}
      <PickProductForCompModal
        open={openPickComp}
        onClose={()=>setOpenPickComp(false)}
        onPicked={(pid) => {
          setOpenPickComp(false)
          setProductForComp(pid)
          setOpenComp(true)
        }}
      />

      {/* Editor de Composición (ya permite múltiples MP con “+ Agregar MP”) */}
      <CompositionModal
        open={openComp}
        onClose={()=>setOpenComp(false)}
        productId={productForComp}
        onDone={()=>{ /* ok */ }}
      />
    </section>
  )
}
