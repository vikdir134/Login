import { useEffect, useState } from 'react'
import { createColor, createMaterial, createPresentation, listProducts } from '../api/almacen'

const TABS = ['material','color','presentacion']

export default function ExtrasModal({ open, onClose, onSaved }) {
  const [tab, setTab] = useState('material')
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  // material
  const [matDesc, setMatDesc] = useState('')

  // color
  const [colDesc, setColDesc] = useState('')

  // presentacion
  const [products, setProducts] = useState([])
  const [productId, setProductId] = useState('')
  const [pesoKg, setPesoKg] = useState('')

  useEffect(() => {
    if (!open) return
    setTab('material'); setMsg('')
    listProducts({ limit: 1000 }).then(setProducts).catch(() => setProducts([]))
  }, [open])

  const reset = () => {
    setMatDesc(''); setColDesc(''); setProductId(''); setPesoKg(''); setMsg('')
  }

  const submit = async (e) => {
    e.preventDefault()
    setMsg('')
    setSaving(true)
    try {
      if (tab === 'material') {
        if (!matDesc || matDesc.trim().length < 2) throw new Error('Descripción de material inválida')
        await createMaterial({ descripcion: matDesc.trim() })
      } else if (tab === 'color') {
        if (!colDesc || colDesc.trim().length < 2) throw new Error('Descripción de color inválida')
        await createColor({ descripcion: colDesc.trim() })
      } else {
        // presentacion
        if (!productId) throw new Error('Selecciona un producto')
        if (!(Number(pesoKg) > 0)) throw new Error('Peso de presentación inválido')
        await createPresentation({ productId: Number(productId), pesoKg: Number(pesoKg) })
      }
      onSaved?.()
      reset()
      onClose?.()
    } catch (e2) {
      console.error(e2)
      setMsg(e2.response?.data?.error || e2.message || 'Error guardando')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null
  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h4 style={{ margin:0 }}>Extras</h4>
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>

        <div style={{ display:'flex', gap:8, marginTop:12 }}>
          {TABS.map(t => (
            <button
              key={t}
              className={`btn-secondary${tab===t?' nav-item--active':''}`}
              onClick={()=>setTab(t)}
            >
              {t === 'material' ? 'Material' : t === 'color' ? 'Color' : 'Presentación'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} style={{ display:'grid', gap:12, marginTop:12 }}>
          {tab === 'material' && (
            <label className="form-field">
              <span>Descripción del material</span>
              <input value={matDesc} onChange={e => setMatDesc(e.target.value)} placeholder="Ej. Polipropileno" />
            </label>
          )}

          {tab === 'color' && (
            <label className="form-field">
              <span>Descripción del color</span>
              <input value={colDesc} onChange={e => setColDesc(e.target.value)} placeholder="Ej. Azul" />
            </label>
          )}

          {tab === 'presentacion' && (
            <>
              <label className="form-field">
                <span>Producto</span>
                <select value={productId} onChange={e => setProductId(e.target.value)}>
                  <option value="">—</option>
                  {products.map(p => (
                    <option key={p.id || p.ID_PRODUCT} value={p.id || p.ID_PRODUCT}>
                      {p.name || p.DESCRIPCION || `Producto #${p.id || p.ID_PRODUCT}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Peso de la presentación (kg)</span>
                <input type="number" step="0.01" min="0.01" value={pesoKg} onChange={e => setPesoKg(e.target.value)} />
              </label>
            </>
          )}

          <div style={{ display:'flex', gap:8 }}>
            <div style={{ flex:1 }} />
            <button className="btn" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>

          {msg && <div className="error">{msg}</div>}
        </form>
      </div>
    </div>
  )
}
