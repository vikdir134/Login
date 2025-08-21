import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import { fetchSuppliers, createPurchase } from '../api/purchases'
import { fetchPrimaryMaterials } from '../api/stock'

export default function PurchaseModal({ open, onClose, onDone }) {
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [suppliers, setSuppliers] = useState([])
  const [primaries, setPrimaries] = useState([])

  const [head, setHead] = useState({
    supplierId: '',
    invoiceType: 'FACTURA',    // opcional: FACTURA/BOLETA/GUIA
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().slice(0,10),
    obs: ''
  })

  const [items, setItems] = useState([
    { primaterId: '', quantity: '', unitCost: '', obs: '' }
  ])

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    Promise.all([
      fetchSuppliers().catch(()=>[]),
      fetchPrimaryMaterials().catch(()=>[])
    ]).then(([ss, pms]) => {
      if (!alive) return
      setSuppliers(ss || [])
      setPrimaries(pms || [])
      setMsg('')
    }).catch(() => setMsg('No se pudieron cargar catálogos'))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [open])

  const addItem = () => setItems(prev => [...prev, { primaterId: '', quantity: '', unitCost: '', obs: '' }])
  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i))
  const patchItem = (i, patch) => setItems(prev => prev.map((r, idx) => idx===i ? { ...r, ...patch } : r))

  const canSubmit = useMemo(() => {
    if (!head.supplierId || !head.invoiceNumber || !head.invoiceDate) return false
    if (!items.length) return false
    for (const it of items) {
      if (!it.primaterId || Number(it.quantity) <= 0 || Number(it.unitCost) < 0) return false
    }
    return true
  }, [head, items])

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setMsg('')
    try {
      const payload = {
        supplierId: Number(head.supplierId),
        invoiceType: head.invoiceType,
        invoiceNumber: head.invoiceNumber.trim(),
        invoiceDate: head.invoiceDate,
        obs: head.obs?.trim() || null,
        items: items.map(it => ({
          primaterId: Number(it.primaterId),
          quantity: Number(it.quantity),
          unitCost: Number(it.unitCost),
          obs: it.obs?.trim() || null
        }))
      }
      await createPurchase(payload)
      onDone?.()
      onClose()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error creando compra')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nueva compra (Materia Prima)">
      {loading ? <div className="muted">Cargando…</div> : (
        <form onSubmit={submit} style={{ display:'grid', gap:12 }}>
          <div className="grid-3">
            <label>
              Proveedor
              <select value={head.supplierId} onChange={e=>setHead(h=>({ ...h, supplierId: e.target.value }))} required>
                <option value="">—</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name || s.RAZON_SOCIAL || `Prov #${s.id}`}</option>
                ))}
              </select>
            </label>
            <label>
              Tipo
              <select value={head.invoiceType} onChange={e=>setHead(h=>({ ...h, invoiceType: e.target.value }))}>
                <option value="FACTURA">FACTURA</option>
                <option value="BOLETA">BOLETA</option>
                <option value="GUIA">GUÍA</option>
              </select>
            </label>
            <label>
              Número
              <input value={head.invoiceNumber} onChange={e=>setHead(h=>({ ...h, invoiceNumber: e.target.value }))} required />
            </label>
          </div>

          <div className="grid-3">
            <label>
              Fecha
              <input type="date" value={head.invoiceDate} onChange={e=>setHead(h=>({ ...h, invoiceDate: e.target.value }))} required />
            </label>
            <label className="form-field" />
            <label>
              Observación (opcional)
              <input value={head.obs} onChange={e=>setHead(h=>({ ...h, obs: e.target.value }))} />
            </label>
          </div>

          <div className="muted" style={{ marginTop:6 }}>Ítems</div>
          {items.map((it, i) => (
            <div key={i} className="form-row">
              <label className="form-field">
                <span>Materia Prima</span>
                <select value={it.primaterId} onChange={e=>patchItem(i,{ primaterId: e.target.value })} required>
                  <option value="">—</option>
                  {primaries.map(pm => (
                    <option key={pm.ID_PRIMATER || pm.id} value={pm.ID_PRIMATER || pm.id}>
                      {pm.DESCRIPCION || pm.name || `MP #${pm.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Cantidad (kg)</span>
                <input type="number" step="0.01" min="0.01" value={it.quantity}
                       onChange={e=>patchItem(i,{ quantity: e.target.value })} required />
              </label>
              <label className="form-field">
                <span>Costo unitario</span>
                <input type="number" step="0.01" min="0" value={it.unitCost}
                       onChange={e=>patchItem(i,{ unitCost: e.target.value })} required />
              </label>
              <div className="form-actions" style={{ gap:8 }}>
                {items.length > 1 && (
                  <button type="button" className="btn-secondary" onClick={()=>removeItem(i)}>Quitar</button>
                )}
              </div>
            </div>
          ))}

          <div style={{ display:'flex', gap:8 }}>
            <button type="button" className="btn-secondary" onClick={addItem}>+ Ítem</button>
            <div style={{ flex:1 }} />
            <button className="btn" disabled={!canSubmit}>Guardar compra</button>
          </div>

          {msg && <div className="muted" style={{ marginTop:8 }}>{msg}</div>}
        </form>
      )}
    </Modal>
  )
}
