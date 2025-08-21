// frontend/src/components/ExtrasModal.jsx
import { useEffect, useState } from 'react'
import { createColor, createMaterial, createPresentation, fetchProductsLite } from '../api/extras'

export default function ExtrasModal({ open, onClose }) {
  const [tab, setTab] = useState('COLOR')
  const [name, setName] = useState('')

  const [products, setProducts] = useState([])
  const [productId, setProductId] = useState('')
  const [presentationKg, setPresentationKg] = useState('')
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return
    setTab('COLOR'); setName(''); setMsg(''); setProductId(''); setPresentationKg('')
    fetchProductsLite().then(setProducts).catch(()=>setProducts([]))
  }, [open])

  const submit = async (e) => {
    e.preventDefault(); setMsg(''); setSending(true)
    try {
      if (tab === 'COLOR') {
        if (!name.trim()) throw new Error('Nombre requerido')
        await createColor(name.trim())
        setMsg('✅ Color creado')
      } else if (tab === 'MATERIAL') {
        if (!name.trim()) throw new Error('Nombre requerido')
        await createMaterial(name.trim())
        setMsg('✅ Material creado')
      } else {
        if (!productId) throw new Error('Selecciona producto')
        if (!(+presentationKg > 0)) throw new Error('Presentación inválida')
        await createPresentation({ productId: Number(productId), presentationKg: Number(presentationKg) })
        setMsg('✅ Presentación agregada')
      }
    } catch (err) {
      setMsg(err.response?.data?.error || err.message || 'Error')
    } finally {
      setSending(false)
    }
  }

  if (!open) return null
  return (
    <div className="modal modal--center">
      <div className="modal__card">
        <div className="modal__header">
          <h4 style={{ margin:0 }}>Extras</h4>
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>

        <div style={{ display:'flex', gap:6, marginBottom:8 }}>
          <button className={tab==='COLOR'?'btn':'btn-secondary'} onClick={()=>setTab('COLOR')}>Agregar Color</button>
          <button className={tab==='MATERIAL'?'btn':'btn-secondary'} onClick={()=>setTab('MATERIAL')}>Agregar Material</button>
          <button className={tab==='PRESENT'?'btn':'btn-secondary'} onClick={()=>setTab('PRESENT')}>Agregar Presentación</button>
        </div>

        <form onSubmit={submit} className="form-col" style={{ gap:12 }}>
          {tab !== 'PRESENT' ? (
            <label className="form-field">
              <span>Nombre</span>
              <input value={name} onChange={e=>setName(e.target.value)} required />
            </label>
          ) : (
            <>
              <label className="form-field">
                <span>Producto</span>
                <select value={productId} onChange={e=>setProductId(e.target.value)} required>
                  <option value="">—</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name || p.DESCRIPCION}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span>Presentación (kg)</span>
                <input type="number" step="0.01" min="0.01" value={presentationKg} onChange={e=>setPresentationKg(e.target.value)} required />
              </label>
            </>
          )}

          {msg && <div className={/✅/.test(msg)?'muted':'error'}>{msg}</div>}
          <div className="form-actions" style={{ justifyContent:'flex-end' }}>
            <button className="btn" disabled={sending}>{sending ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
