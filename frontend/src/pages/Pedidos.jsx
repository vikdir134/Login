// src/pages/Pedidos.jsx
import { useEffect, useMemo, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { listOrdersCombined, createOrderApi } from '../api/orders' // 👈 usamos el que devuelve {items,total}
import { hasRole, getUserFromToken } from '../utils/auth'
import { fetchCustomers } from '../api/customers'
import api from '../api/axios'

/** Utils */
const normalize = (s='') =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase()

const badgeClass = (state) => {
  switch (String(state || '').toUpperCase()) {
    case 'PENDIENTE':   return 'badge badge--danger'
    case 'EN_PROCESO':  return 'badge badge--warning'
    case 'ENTREGADO':   return 'badge badge--success'
    case 'CANCELADO':   return 'badge badge--dark'
    default:            return 'badge'
  }
}

/** Filtro para autocomplete */
function filterStartsThenIncludes(options, query, getLabel){
  const q = normalize(query)
  if (!q) return []
  const starts = []
  const includes = []
  for (const opt of options){
    const l = normalize(getLabel(opt))
    if (l.startsWith(q)) starts.push(opt)
    else if (l.includes(q)) includes.push(opt)
  }
  return [...starts, ...includes]
}

/** Autocomplete ligero */
function Autocomplete({
  label,
  value,
  display,
  onChange,
  options,
  getLabel,
  getKey,
  placeholder = 'Escribe para buscar…'
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(display || '')
  const [hoverIdx, setHoverIdx] = useState(-1)
  const boxRef = useRef(null)

  useEffect(()=>{
    const onDoc = (e)=>{
      if (!boxRef.current) return
      if (!boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return ()=> document.removeEventListener('mousedown', onDoc)
  },[])

  const results = useMemo(()=>{
    if (!query) return []
    return filterStartsThenIncludes(options, query, getLabel).slice(0, 20)
  },[options, query, getLabel])

  useEffect(()=>{ setQuery(display || '') }, [display])

  const choose = (opt) => {
    const id = getKey(opt)
    const text = getLabel(opt)
    onChange(id, opt)
    setQuery(text)
    setOpen(false)
  }

  const onKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true); return
    }
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHoverIdx(i => Math.min(results.length-1, i+1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHoverIdx(i => Math.max(0, i-1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = results[hoverIdx] ?? results[0]
      if (opt) choose(opt)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <label className="form-field" ref={boxRef} style={{ position:'relative' }}>
      {label && <span>{label}</span>}
      <input
        value={query}
        onChange={e=>{ setQuery(e.target.value); setOpen(true) }}
        onFocus={()=> setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <div
          className="card"
          style={{
            position:'absolute', left:0, right:0, top:'100%', zIndex:20,
            marginTop:4, maxHeight:280, overflow:'auto', padding:6
          }}
        >
          {results.map((opt, idx)=>(
            <div
              key={getKey(opt)}
              onMouseEnter={()=>setHoverIdx(idx)}
              onMouseDown={(e)=> e.preventDefault()}
              onClick={()=>choose(opt)}
              style={{
                padding:'8px 10px', borderRadius:10,
                background: idx===hoverIdx ? 'rgba(0,0,0,0.05)' : 'transparent',
                cursor:'pointer'
              }}
            >
              {getLabel(opt)}
            </div>
          ))}
        </div>
      )}
    </label>
  )
}

export default function Pedidos() {
  const me = getUserFromToken()
  const puedeCrear = hasRole(me, 'PRODUCCION') || hasRole(me, 'JEFE') || hasRole(me, 'ADMINISTRADOR')

  // filtros
  const [q, setQ] = useState('')
  const [state, setState] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  // tabla
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [msg, setMsg] = useState('')

  // paginado
  const pageSize = 30
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)

  // catálogos
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])

  // crear pedido
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    customerId: '',
    customerLabel: '',
    lines: [{ productId: '', productLabel:'', peso: '', presentacion: '' }]
  })

  // cargar catálogos una vez
  useEffect(() => {
    (async ()=>{
      try {
        const cs = await fetchCustomers({ q: '', limit: 1000 })
        setCustomers(Array.isArray(cs) ? cs : [])
        const pRes = await api.get('/api/catalog/products?limit=1000').catch(()=>({ data: [] }))
        setProducts(Array.isArray(pRes.data) ? pRes.data : [])
      } catch {
        setCustomers([]); setProducts([])
      }
    })()
  }, [])

  // fetch de pedidos (paginado)
  const load = async ({ signal } = {}) => {
    setLoading(true); setMsg('')
    try {
      // Construir CSV de estados si hay
      const stateCsv = state ? state : '' // uno solo; si luego permites múltiple, únelo con comas
      const params = {
        q: q || undefined,
        state: stateCsv || undefined,
        from: from || undefined, // 👈 se envían por si el backend ya los soporta en /search
        to: to || undefined,
        limit: pageSize,
        offset: page * pageSize
      }
      const data = await listOrdersCombined(params) // { items, total }
      if (signal?.aborted) return
      setRows(Array.isArray(data?.items) ? data.items : [])
      setTotal(Number(data?.total || 0))
    } catch (e) {
      if (signal?.aborted) return
      console.error(e)
      setMsg('Error cargando pedidos')
      setRows([]); setTotal(0)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  // búsqueda reactiva con debounce (q/state/from/to) y resetear página a 0
  useEffect(() => {
    const controller = new AbortController()
    const t = setTimeout(() => {
      setPage(0) // reset
      load({ signal: controller.signal })
    }, 350)
    return () => { controller.abort(); clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, state, from, to])

  // recarga cuando cambia la página
  useEffect(() => {
    const controller = new AbortController()
    load({ signal: controller.signal })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const canPrev = page > 0
  const canNext = (page + 1) * pageSize < total
  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize))

  // helpers form
  const addLine = () => {
    setForm(f => ({ ...f, lines: [...f.lines, { productId: '', productLabel:'', peso: '', presentacion: '' }] }))
  }
  const removeLine = (idx) => {
    setForm(f => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }))
  }
  const setLine = (idx, patch) => {
    setForm(f => ({
      ...f,
      lines: f.lines.map((ln, i) => i === idx ? { ...ln, ...patch } : ln)
    }))
  }

  const canSubmit = useMemo(() => {
    if (!form.customerId) return false
    if (!Array.isArray(form.lines) || form.lines.length === 0) return false
    for (const l of form.lines) {
      if (!l.productId || Number(l.peso) <= 0 || Number(l.presentacion) <= 0) return false
    }
    return true
  }, [form])

  const submitCreate = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setCreating(true); setMsg('')
    try {
      const payload = {
        customerId: Number(form.customerId),
        lines: form.lines.map(l => ({
          productId: Number(l.productId),
          peso: Number(l.peso),
          presentacion: Number(l.presentacion)
        }))
      }
      await createOrderApi(payload)
      setShowCreate(false)
      setForm({ customerId: '', customerLabel:'', lines: [{ productId: '', productLabel:'', peso: '', presentacion: '' }] })
      setPage(0)
      await load()
      setMsg('✅ Pedido creado')
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error creando pedido')
    } finally {
      setCreating(false)
    }
  }

  const customerLabel = (c) => `${c.razonSocial || c.RAZON_SOCIAL} — ${c.RUC}`
  const productLabel  = (p) => p.name || p.DESCRIPCION || `Producto #${p.id}`

  return (
    <section className="card">
      <div className="topbar" style={{ marginBottom: 0 }}>
        <h3 style={{ margin: 0 }}>Pedidos</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {puedeCrear && (
            <button className="btn" onClick={() => setShowCreate(v => !v)}>
              {showCreate ? 'Cerrar' : 'Nuevo pedido'}
            </button>
          )}
        </div>
      </div>

      {/* Filtros (reactivos) */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
        <input placeholder="Buscar (cliente/RUC)" value={q} onChange={e => setQ(e.target.value)} />
        <select value={state} onChange={e => setState(e.target.value)}>
          <option value="">Estado</option>
          <option value="PENDIENTE">PENDIENTE</option>
          <option value="EN_PROCESO">EN_PROCESO</option>
          <option value="ENTREGADO">ENTREGADO</option>
          <option value="CANCELADO">CANCELADO</option>
        </select>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} />
      </div>

      {msg && <div className="muted" style={{ marginTop: 8 }}>{msg}</div>}

      {/* Nuevo pedido */}
      {showCreate && puedeCrear && (
        <div className="card" style={{ marginTop: 14 }}>
          <h4 style={{ marginTop: 0 }}>Crear pedido</h4>
          <form onSubmit={submitCreate} style={{ display: 'grid', gap: 12 }}>
            {/* Cliente */}
            <Autocomplete
              label="Cliente"
              value={form.customerId}
              display={form.customerLabel}
              options={customers}
              getLabel={customerLabel}
              getKey={(c)=> c.id}
              placeholder="Escribe RUC o Razón social…"
              onChange={(id, obj)=> setForm(f=>({ ...f, customerId: id, customerLabel: customerLabel(obj) }))}
            />

            <div className="muted">Líneas del pedido</div>
            {form.lines.map((ln, idx) => (
              <div key={idx} className="form-row" style={{ alignItems:'end' }}>
                {/* Producto */}
                <div style={{ flex:1 }}>
                  <Autocomplete
                    label="Producto"
                    value={ln.productId}
                    display={ln.productLabel}
                    options={products}
                    getLabel={productLabel}
                    getKey={(p)=> p.id}
                    placeholder="Escribe para buscar producto…"
                    onChange={(id, obj)=> setLine(idx, { productId:id, productLabel: productLabel(obj) })}
                  />
                </div>

                <label className="form-field">
                  <span>Peso (kg)</span>
                  <input
                    type="number" step="0.01" min="0.01"
                    value={ln.peso}
                    onChange={e => setLine(idx, { peso: e.target.value })}
                    required
                  />
                </label>
                <label className="form-field">
                  <span>Presentación</span>
                  <input
                    type="number" step="1" min="1"
                    value={ln.presentacion}
                    onChange={e => setLine(idx, { presentacion: e.target.value })}
                    required
                  />
                </label>
                <div className="form-actions" style={{ gap: 8 }}>
                  {form.lines.length > 1 && (
                    <button type="button" className="btn-secondary" onClick={() => removeLine(idx)}>Quitar</button>
                  )}
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn-secondary" onClick={addLine}>+ Línea</button>
              <div style={{ flex: 1 }} />
              <button className="btn" disabled={!canSubmit || creating}>
                {creating ? 'Creando…' : 'Crear pedido'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabla */}
      <div className="table" style={{ marginTop: 14 }}>
        <div className="table__head">
          <div>Fecha</div>
          <div>Cliente</div>
          <div>Estado</div>
          <div>Acciones</div>
        </div>
        {!loading && rows.map(row => (
          <div className="table__row" key={row.id}>
            <div>{new Date(row.fecha).toLocaleString()}</div>
            <div>{row.customerName}</div>
            <div><span className={badgeClass(row.state)}>{row.state}</span></div>
            <div>
              <Link className="btn-secondary" to={`/app/pedidos/${row.id}`}>Ver</Link>
            </div>
          </div>
        ))}
        {loading && <div className="muted">Cargando…</div>}
        {!loading && rows.length === 0 && <div className="muted">Sin resultados</div>}
      </div>

      {/* Paginación */}
      <div style={{ display:'flex', gap:8, marginTop:10, alignItems:'center' }}>
        <button
          className="btn-secondary"
          disabled={!canPrev}
          onClick={()=>setPage(p=>Math.max(0, p-1))}
        >
          Anterior
        </button>
        <div className="muted">Página {page+1} de {totalPages}</div>
        <button
          className="btn-secondary"
          disabled={!canNext}
          onClick={()=>setPage(p=>p+1)}
        >
          Siguiente
        </button>
      </div>
    </section>
  )
}
