// src/components/ProductForm.jsx
import { useEffect, useMemo, useState } from 'react'
import { listProducts, createProduct, addCompositions } from '../api/products'
import { listMaterials } from '../api/materials'

const ZONES = ['TRONCO','ALMA','CUBIERTA']  // opciones guiadas

export default function ProductForm({ onCreated }) {
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)

  // catálogo para composición
  const [primaters, setPrimaters] = useState([]) // aquí deberías listar PRIMARY_MATERIALS (no sólo MATERIALS)
  // mientras no haya endpoint: usa MATERIALS como demo
  useEffect(() => {
    listMaterials().then(setPrimaters).catch(()=>setPrimaters([]))
  }, [])

  // producto base
  const [form, setForm] = useState({
    tipoProducto: '',
    diameter: '',
    descripcion: ''
  })

  // composición opcional
  const [addComp, setAddComp] = useState(false)
  const [items, setItems] = useState([
    { primaterId: '', zone: 'TRONCO', percentage: '' }
  ])

  const onChange = e => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  const setItem = (idx, patch) => {
    setItems(arr => arr.map((it, i) => i===idx ? { ...it, ...patch } : it))
  }
  const addItem = () => setItems(arr => [...arr, { primaterId: '', zone: 'TRONCO', percentage: '' }])
  const rmItem = (idx) => setItems(arr => arr.filter((_,i)=>i!==idx))

  const totalPct = useMemo(
    () => items.reduce((a,it)=> a + (Number(it.percentage)||0), 0),
    [items]
  )

  const submit = async (e) => {
    e.preventDefault()
    setMsg('')
    if (!form.tipoProducto.trim() || !form.diameter.trim() || !form.descripcion.trim()) {
      setMsg('Completa tipo, diámetro y descripción')
      return
    }
    if (addComp) {
      for (const it of items) {
        if (!it.primaterId || !it.zone || Number(it.percentage) < 0 || Number(it.percentage) > 100) {
          setMsg('Composición: selecciona materia prima, zona y % (0–100)')
          return
        }
      }
      // (opcional) si quieres forzar suma 100%:
      // if (Math.abs(totalPct - 100) > 1e-6) { setMsg('La suma de porcentajes debe ser 100%'); return }
    }

    setSending(true)
    try {
      // 1) crear producto
      const created = await createProduct({
        tipoProducto: form.tipoProducto,
        diameter: form.diameter,
        descripcion: form.descripcion
      })

      // 2) composición (opcional)
      if (addComp && items.length) {
        const compPayload = items.map(it => ({
          primaterId: Number(it.primaterId),      // ID_PRIMATER real (placeholder ahora)
          zone: it.zone,
          percentage: Number(it.percentage)
        }))
        await addCompositions(created.id, compPayload)
      }

      setMsg('✅ Producto creado')
      setForm({ tipoProducto:'', diameter:'', descripcion:'' })
      setItems([{ primaterId:'', zone:'TRONCO', percentage:'' }])
      setAddComp(false)
      onCreated?.()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error creando producto')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="card">
      <h4 style={{marginTop:0}}>Crear Producto Terminado</h4>
      <form onSubmit={submit} style={{ display:'grid', gap:12 }}>
        <label>Tipo de producto
          <input name="tipoProducto" value={form.tipoProducto} onChange={onChange} placeholder="Soga, Cuerda…" />
        </label>
        <label>Diámetro
          <input name="diameter" value={form.diameter} onChange={onChange} placeholder="12mm" />
        </label>
        <label>Descripción
          <input name="descripcion" value={form.descripcion} onChange={onChange} placeholder="Soga 12mm polipropileno" />
        </label>

        <label style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type="checkbox" checked={addComp} onChange={e=>setAddComp(e.target.checked)} />
          <span>Agregar composición (opcional)</span>
        </label>

        {addComp && (
          <div className="card" style={{marginTop:8}}>
            <div className="muted" style={{marginBottom:8}}>
              Define la receta por zonas. Cada ítem: Materia prima + Zona + % (0–100).
            </div>
            {items.map((it, idx) => (
              <div key={idx} className="form-row">
                <label className="form-field">
                  <span>Materia prima</span>
                  <select value={it.primaterId} onChange={e=>setItem(idx, { primaterId: e.target.value })}>
                    <option value="">—</option>
                    {primaters.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name || m.DESCRIPCION || `Mat #${m.id}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>Zona</span>
                  <select value={it.zone} onChange={e=>setItem(idx, { zone: e.target.value })}>
                    {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                </label>
                <label className="form-field">
                  <span>%</span>
                  <input type="number" min="0" max="100" step="0.01"
                    value={it.percentage}
                    onChange={e=>setItem(idx, { percentage: e.target.value })}
                    placeholder="0.00" />
                </label>
                <div className="form-actions" style={{gap:8}}>
                  {items.length > 1 && (
                    <button type="button" className="btn-secondary" onClick={()=>rmItem(idx)}>Quitar</button>
                  )}
                </div>
              </div>
            ))}
            <div style={{display:'flex', gap:8, marginTop:8}}>
              <button type="button" className="btn-secondary" onClick={addItem}>+ Ítem</button>
              <div className="muted" style={{alignSelf:'center'}}>Suma actual: {totalPct.toFixed(2)}%</div>
            </div>
          </div>
        )}

        <div style={{ display:'flex', gap:8 }}>
          <button className="btn" disabled={sending}>{sending ? 'Guardando…' : 'Crear producto'}</button>
        </div>
        {msg && <div className="muted">{msg}</div>}
      </form>
    </div>
  )
}
