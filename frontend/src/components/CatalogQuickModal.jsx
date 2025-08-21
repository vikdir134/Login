import { useEffect, useState } from 'react'
import Modal from './Modal'
import { createMaterial, createColor, fetchProducts, createPresentation } from '../api/stock'

export default function CatalogQuickModal({ open, onClose }) {
  const [tab, setTab] = useState('material') // material | color | presentacion
  const [msg, setMsg] = useState('')

  // material/color
  const [text, setText] = useState('')

  // presentacion
  const [products, setProducts] = useState([])
  const [pres, setPres] = useState({ productId: '', peso: '' })

  useEffect(() => {
    if (!open) return
    if (tab !== 'presentacion') return
    let alive = true
    fetchProducts().then(ps => { if (alive) setProducts(ps || []) })
                   .catch(()=>{})
    return () => { alive = false }
  }, [open, tab])

  const submit = async (e) => {
    e.preventDefault()
    setMsg('')
    try {
      if (tab === 'material') {
        if (!text.trim()) return
        await createMaterial({ descripcion: text.trim() })
        setText('')
        setMsg('✅ Material creado')
      } else if (tab === 'color') {
        if (!text.trim()) return
        await createColor({ descripcion: text.trim() })
        setText('')
        setMsg('✅ Color creado')
      } else {
        if (!pres.productId || Number(pres.peso) <= 0) return
        await createPresentation({ productId: Number(pres.productId), peso: Number(pres.peso) })
        setPres({ productId: '', peso: '' })
        setMsg('✅ Presentación creada')
      }
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error guardando datos')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Extras: Material / Color / Presentación">
      <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap' }}>
        <button className={'btn-secondary' + (tab==='material' ? ' nav-item--active' : '')} onClick={()=>setTab('material')}>Material</button>
        <button className={'btn-secondary' + (tab==='color' ? ' nav-item--active' : '')} onClick={()=>setTab('color')}>Color</button>
        <button className={'btn-secondary' + (tab==='presentacion' ? ' nav-item--active' : '')} onClick={()=>setTab('presentacion')}>Presentación</button>
      </div>

      <form onSubmit={submit} style={{ display:'grid', gap:12 }}>
        {tab !== 'presentacion' ? (
          <>
            <label>
              {tab === 'material' ? 'Nombre del material' : 'Nombre del color'}
              <input value={text} onChange={e=>setText(e.target.value)} placeholder={tab==='material' ? 'Polipropileno' : 'Azul Royal'} />
            </label>
          </>
        ) : (
          <>
            <label>
              Producto
              <select value={pres.productId} onChange={e=>setPres(p=>({ ...p, productId: e.target.value }))} required>
                <option value="">—</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.DESCRIPCION || p.name || `Producto #${p.id}`}</option>
                ))}
              </select>
            </label>
            <label>
              Peso presentación (kg)
              <input type="number" step="0.01" min="0.01" value={pres.peso}
                     onChange={e=>setPres(p=>({ ...p, peso: e.target.value }))} />
            </label>
          </>
        )}

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>Cerrar</button>
          <button className="btn">Guardar</button>
        </div>

        {msg && <div className="muted" style={{ marginTop:8 }}>{msg}</div>}
      </form>
    </Modal>
  )
}
