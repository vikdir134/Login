// src/pages/Compras.jsx
import { useEffect, useMemo, useState } from 'react'
import { listSuppliers, createSupplier } from '../api/suppliers'
import { listPrimaryMaterials } from '../api/primary-materials'
import { listPurchases, createPurchase, getPurchase } from '../api/purchases'
import { hasRole, getUserFromToken } from '../utils/auth'
import AddSupplierModal from '../components/AddSupplierModal'

const DOC_TYPES = ['FACTURA', 'BOLETA', 'GUIA', 'OTRO']
const IGV_RATE = 0.18

export default function Compras() {
  const me = getUserFromToken()
  const puedeCrear = hasRole(me, 'ALMACENERO') || hasRole(me, 'JEFE') || hasRole(me, 'ADMINISTRADOR')

  const [suppliers, setSuppliers] = useState([])
  const [materials, setMaterials] = useState([])

  // filtros de lista
  const [filtros, setFiltros] = useState({ supplierId: '', from: '', to: '' })
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  // expand de ítems
  const [expandedId, setExpandedId] = useState(null)
  const [expandedData, setExpandedData] = useState(null)
  const [loadingExpanded, setLoadingExpanded] = useState(false)

  // modal proveedor
  const [showSupplier, setShowSupplier] = useState(false)

  // form de compra
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    supplierId: '',
    documentType: 'FACTURA',
    documentNumber: '',
    documentDate: new Date().toISOString().slice(0,10),
    currency: 'PEN',
    notes: '',
    items: [{ primaterId: '', quantity: '', unitPrice: '' }]
  })

  // ====== cálculos automáticos (NETO / IGV / TOTAL) ======
  const itemsPrepared = useMemo(() => {
    return (form.items || []).map(it => ({
      ...it,
      qNum: Number(it.quantity || 0),
      pNum: Number(it.unitPrice || 0),
      line: Number(it.quantity || 0) * Number(it.unitPrice || 0)
    }))
  }, [form.items])

  const totalNet = useMemo(
    () => itemsPrepared.reduce((acc, it) => acc + it.line, 0),
    [itemsPrepared]
  )
  const taxAmount = useMemo(() => +(totalNet * IGV_RATE).toFixed(2), [totalNet])
  const totalAmount = useMemo(() => +(totalNet + taxAmount).toFixed(2), [totalNet, taxAmount])

  // cargar catálogos
  const refreshSuppliers = async () => {
    try {
      const s = await listSuppliers({ limit: 1000 })
      setSuppliers(Array.isArray(s) ? s : s.data || [])
    } catch {/* no op */}
  }

  useEffect(() => {
    let alive = true
    Promise.all([
      listSuppliers({ limit: 1000 }).catch(() => ([])),
      listPrimaryMaterials({ limit: 1000 }).catch(() => ([]))
    ])
      .then(([s, m]) => {
        if (!alive) return
        setSuppliers(Array.isArray(s) ? s : s.data || [])
        setMaterials(Array.isArray(m) ? m : m.data || [])
      })
      .catch(() => setMsg('No se pudo cargar catálogos'))
    return () => { alive = false }
  }, [])

  // cargar lista de compras
  const load = async () => {
    setLoading(true); setMsg('')
    try {
      const data = await listPurchases({
        supplierId: filtros.supplierId || undefined,
        from: filtros.from || undefined,
        to: filtros.to || undefined,
        limit: 20
      })
      setRows(data)
    } catch (e) {
      setMsg('Error cargando compras')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const setField = (patch) => setForm(f => ({ ...f, ...patch }))
  const setItem = (idx, patch) => setForm(f => ({
    ...f,
    items: f.items.map((it, i) => i === idx ? { ...it, ...patch } : it)
  }))
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { primaterId: '', quantity: '', unitPrice: '' }] }))
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))

  const canSubmit = useMemo(() => {
    const headOk = form.supplierId && form.documentType && form.documentNumber && form.documentDate
    if (!headOk) return false
    if (!Array.isArray(form.items) || form.items.length === 0) return false
    for (const it of form.items) {
      if (!it.primaterId || Number(it.quantity) <= 0 || Number(it.unitPrice) < 0) return false
    }
    return true
  }, [form])

  const onSubmit = async (e) => {
    e.preventDefault()
    setMsg('')

    const payload = {
      supplierId: Number(form.supplierId),
      documentType: form.documentType,
      documentNumber: form.documentNumber.trim(),
      documentDate: form.documentDate,
      currency: form.currency || 'PEN',
      taxAmount,                               // IGV auto (18%)
      notes: form.notes || null,
      items: form.items.map(it => ({
        primaterId: Number(it.primaterId),
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        notes: it.notes || null
      }))
    }

    setSaving(true)
    try {
      await createPurchase(payload)
      setMsg('✅ Compra registrada')
      setShowForm(false)
      // reset
      setForm({
        supplierId: '',
        documentType: 'FACTURA',
        documentNumber: '',
        documentDate: new Date().toISOString().slice(0,10),
        currency: 'PEN',
        notes: '',
        items: [{ primaterId: '', quantity: '', unitPrice: '' }]
      })
      load()
    } catch (err) {
      console.error(err)
      const apiMsg = err.response?.data?.error || err.message || 'Error creando compra'
      setMsg(apiMsg)
    } finally {
      setSaving(false)
    }
  }

  // expandir ítems de una compra
  const toggleExpand = async (row) => {
    const id = row.id || row.ID_PURCHASE
    if (expandedId === id) {
      setExpandedId(null); setExpandedData(null)
      return
    }
    setExpandedId(id)
    setExpandedData(null)
    setLoadingExpanded(true)
    try {
      const data = await getPurchase(id) // { header, items: [] }
      setExpandedData(data)
    } catch {
      setExpandedData({ error: 'No se pudo cargar ítems' })
    } finally {
      setLoadingExpanded(false)
    }
  }

  return (
    <section className="card">
      <div className="topbar" style={{ marginBottom: 0 }}>
        <h3 style={{ margin: 0 }}>Compras</h3>
        {puedeCrear && (
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn" onClick={() => setShowForm(v => !v)}>
              {showForm ? 'Cerrar' : 'Nueva compra'}
            </button>
            <button className="btn-secondary" onClick={() => setShowSupplier(true)}>
              Nuevo proveedor
            </button>
          </div>
        )}
      </div>

      {/* filtros */}
      <form
        onSubmit={(e)=>{e.preventDefault(); load()}}
        style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr auto', gap:8, marginTop:12 }}
      >
        <select
          value={filtros.supplierId}
          onChange={e => setFiltros(f => ({ ...f, supplierId: e.target.value }))}
        >
          <option value="">Proveedor</option>
          {suppliers.map(s => (
            <option key={s.id || s.ID_SUPPLIER} value={s.id || s.ID_SUPPLIER}>
              {s.name || s.NAME}
            </option>
          ))}
        </select>
        <input type="date" value={filtros.from} onChange={e => setFiltros(f => ({ ...f, from: e.target.value }))} />
        <input type="date" value={filtros.to} onChange={e => setFiltros(f => ({ ...f, to: e.target.value }))} />
        <button className="btn-secondary" type="submit">Filtrar</button>
      </form>

      {msg && <div className="muted" style={{ marginTop:8 }}>{msg}</div>}

      {/* formulario */}
      {showForm && puedeCrear && (
        <div className="card" style={{ marginTop:12 }}>
          <h4 style={{ marginTop:0 }}>Registrar compra</h4>

          <form onSubmit={onSubmit} style={{ display:'grid', gap:12 }}>
            <div className="form-row" style={{ gridTemplateColumns:'2fr 1fr 1fr 1fr' }}>
              <label className="form-field">
                <span>Proveedor</span>
                <select value={form.supplierId} onChange={e => setField({ supplierId: e.target.value })} required>
                  <option value="">—</option>
                  {suppliers.map(s => (
                    <option key={s.id || s.ID_SUPPLIER} value={s.id || s.ID_SUPPLIER}>
                      {s.name || s.NAME}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>Tipo doc.</span>
                <select value={form.documentType} onChange={e => setField({ documentType: e.target.value })} required>
                  {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>

              <label className="form-field">
                <span>Nro. doc.</span>
                <input value={form.documentNumber} onChange={e => setField({ documentNumber: e.target.value })} required />
              </label>

              <label className="form-field">
                <span>Fecha</span>
                <input type="date" value={form.documentDate} onChange={e => setField({ documentDate: e.target.value })} required />
              </label>
            </div>

            <div className="form-row" style={{ gridTemplateColumns:'1fr 2fr' }}>
              <label className="form-field">
                <span>Moneda</span>
                <select value={form.currency} onChange={e => setField({ currency: e.target.value })}>
                  <option value="PEN">PEN</option>
                  <option value="USD">USD</option>
                </select>
              </label>
              <label className="form-field">
                <span>Notas</span>
                <input value={form.notes} onChange={e => setField({ notes: e.target.value })} placeholder="Opcional" />
              </label>
            </div>

            <div className="muted">Ítems</div>
            {form.items.map((it, idx) => {
              const q = Number(it.quantity || 0)
              const p = Number(it.unitPrice || 0)
              const line = q * p
              return (
                <div key={idx} className="form-row" style={{ gridTemplateColumns:'2fr 1fr 1fr auto' }}>
                  <label className="form-field">
                    <span>Materia prima</span>
                    <select value={it.primaterId} onChange={e => setItem(idx, { primaterId: e.target.value })} required>
                      <option value="">—</option>
                      {materials.map(m => (
                        <option key={m.id || m.ID_PRIMATER} value={m.id || m.ID_PRIMATER}>
                          {m.descripcion || m.DESCRIPCION || `MP #${m.id || m.ID_PRIMATER}`}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="form-field">
                    <span>Cantidad (kg)</span>
                    <input
                      type="number" step="0.01" min="0.01"
                      value={it.quantity}
                      onChange={e => setItem(idx, { quantity: e.target.value })}
                      required
                    />
                  </label>

                  <label className="form-field">
                    <span>Precio unitario</span>
                    <input
                      type="number" step="0.01" min="0"
                      value={it.unitPrice}
                      onChange={e => setItem(idx, { unitPrice: e.target.value })}
                      required
                    />
                  </label>

                  <div className="form-actions">
                    <div className="badge">{line.toFixed(2)}</div>
                  </div>

                  {form.items.length > 1 && (
                    <div className="form-actions" style={{ gridColumn: '1 / -1' }}>
                      <button type="button" className="btn-secondary" onClick={() => removeItem(idx)}>Quitar</button>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Totales auto */}
            <div className="card" style={{ background:'transparent', border:'1px dashed var(--border)' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                <div><strong>Neto</strong><div>{totalNet.toFixed(2)} {form.currency}</div></div>
                <div><strong>IGV (18%)</strong><div>{taxAmount.toFixed(2)} {form.currency}</div></div>
                <div><strong>Total</strong><div>{totalAmount.toFixed(2)} {form.currency}</div></div>
              </div>
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button type="button" className="btn-secondary" onClick={addItem}>+ Ítem</button>
              <div style={{ flex:1 }} />
              <button className="btn" disabled={!canSubmit || saving}>{saving ? 'Guardando…' : 'Guardar compra'}</button>
            </div>
          </form>
        </div>
      )}

      {/* tabla de compras */}
      <div className="table" style={{ marginTop: 14 }}>
        <div className="table__head" style={{ gridTemplateColumns:'1fr 1.2fr 1.2fr 1fr' }}>
          <div>Fecha</div>
          <div>Proveedor</div>
          <div>Documento</div>
          <div>Total</div>
        </div>

        {!loading && rows.map((r) => {
          const id = r.id || r.ID_PURCHASE
          const isOpen = expandedId === id
          return (
            <div key={id} style={{ display:'contents' }}>
              <div
                className="table__row"
                style={{ gridTemplateColumns:'1fr 1.2fr 1.2fr 1fr', cursor:'pointer' }}
                onClick={() => toggleExpand(r)}
                title="Ver ítems"
              >
                <div>{new Date(r.documentDate || r.DOCUMENT_DATE).toLocaleDateString()}</div>
                <div>{r.supplierName || r.SUPPLIER_NAME || r.proveedor || r.NAME}</div>
                <div>{`${r.documentType || r.DOCUMENT_TYPE || ''} ${r.documentNumber || r.DOCUMENT_NUMBER || ''}`.trim()}</div>
                <div>{Number(r.totalAmount || r.TOTAL_AMOUNT || 0).toFixed(2)} {r.currency || r.CURRENCY || ''}</div>
              </div>

              {isOpen && (
                <div className="table__row" style={{ gridColumn:'1 / -1' }}>
                  {loadingExpanded && <div className="muted">Cargando ítems…</div>}
                  {!loadingExpanded && expandedData?.items && expandedData.items.length > 0 && (
                    <div style={{ width:'100%' }}>
                      <div className="muted" style={{ marginBottom:8 }}>
                        Ítems de la compra #{id}
                      </div>
                      <div className="table">
                        <div className="table__head" style={{ gridTemplateColumns:'2fr 1fr 1fr 1fr' }}>
                          <div>Materia prima</div>
                          <div>Cantidad (kg)</div>
                          <div>Unitario</div>
                          <div>Total</div>
                        </div>
                        {expandedData.items.map((it, i) => (
                          <div className="table__row" key={i} style={{ gridTemplateColumns:'2fr 1fr 1fr 1fr' }}>
                            <div>{it.material || it.MATERIAL || it.descripcion || it.DESCRIPCION || `MP #${it.primaterId || it.ID_PRIMATER}`}</div>
                            <div>{Number(it.quantity || it.QUANTITY).toFixed(2)}</div>
                            <div>{Number(it.unitPrice || it.UNIT_PRICE).toFixed(2)} {expandedData.header?.currency || 'PEN'}</div>
                            <div>{Number(it.totalPrice || it.TOTAL_PRICE).toFixed(2)} {expandedData.header?.currency || 'PEN'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {!loadingExpanded && expandedData?.items?.length === 0 && <div className="muted">Sin ítems</div>}
                  {!loadingExpanded && expandedData?.error && <div className="error">{expandedData.error}</div>}
                </div>
              )}
            </div>
          )
        })}
        {loading && <div className="muted">Cargando…</div>}
        {!loading && rows.length === 0 && <div className="muted">Sin resultados</div>}
      </div>

      {/* Modal: nuevo proveedor */}
      <AddSupplierModal
        open={showSupplier}
        onClose={() => setShowSupplier(false)}
        onSuccess={refreshSuppliers}
      />
    </section>
  )
}
