import { useEffect, useMemo, useState } from 'react'
import api from '../api/axios'
import { createProduct, setProductComposition } from '../api/products'

// Sugerencias:
const SUG_TIPOS = [
  'Driza', 'Cabo', 'Soga', 'Cuerda', 'Piola', 'Trenza'
]
const SUG_DIAM = [
  '2mm', '3mm', '4mm', '6mm', '8mm', '10mm', '12mm', '14mm', '16mm', '3/16', '1/4', '5/16', '7/16'
]
const SUG_DESC_EJ = (tipo, diam, color='Blanco', material='Polipropileno') =>
  `${tipo || 'Driza'} de ${material} ${diam || '3/16'} ${color}`

const ZONAS = ['TRONCO','ALMA','CUBIERTA']

export default function CreateProductModal({ open, onClose, onDone }) {
  const [tipo, setTipo] = useState('')
  const [diameter, setDiameter] = useState('')
  const [descripcion, setDescripcion] = useState('')

  // composición opcional
  const [materials, setMaterials] = useState([])
  const [rows, setRows] = useState([]) // { primaterId:'', zone:'TRONCO', percentage:'' }
  const [useComp, setUseComp] = useState(false)

  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!open) return
    setTipo(''); setDiameter(''); setDescripcion('')
    setRows([]); setUseComp(false); setMsg('')

    // catálogo MP para el combobox por nombre
    api.get('/api/primary-materials', { params:{ limit: 1000 } })
      .then(r => setMaterials(Array.isArray(r.data) ? r.data : []))
      .catch(()=> setMaterials([]))
  }, [open])

  const canCreate = tipo.trim() && diameter.trim() && descripcion.trim()

  const totalPct = useMemo(() => rows.reduce((a,r)=> a + Number(r.percentage || 0), 0), [rows])
  const compOK = useMemo(() =>
    (!useComp) ||
    (rows.length > 0 &&
     rows.every(r => r.primaterId && r.zone && Number(r.percentage) > 0) &&
     totalPct <= 100 + 1e-9),
    [useComp, rows, totalPct]
  )

  const addRow = () => setRows(rs => [...rs, { primaterId:'', zone:'TRONCO', percentage:'' }])
  const setRow = (i, patch) => setRows(rs => rs.map((r,idx)=> idx===i ? { ...r, ...patch } : r))
  const removeRow = (i) => setRows(rs => rs.filter((_,idx)=> idx!==i))

  const fillSampleDescription = () => {
    setDescripcion(SUG_DESC_EJ(tipo, diameter))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!canCreate || !compOK) return
    setSending(true); setMsg('')
    try {
      // 1) crear PT
      const prod = await createProduct({ tipo: tipo.trim(), diameter: diameter.trim(), descripcion: descripcion.trim() })
      // 2) si hay composición, guardarla
      if (useComp && rows.length > 0) {
        await setProductComposition(prod.id, rows.map(r => ({
          primaterId: Number(r.primaterId),
          zone: r.zone,
          percentage: Number(r.percentage)
        })))
      }
      onDone?.()
      onClose?.()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error creando producto')
    } finally {
      setSending(false)
    }
  }

  if (!open) return null
  return (
    <div className="modal modal--center">
      <div className="modal__card" style={{ minWidth: 520 }}>
        <div className="modal__header">
          <h4 style={{ margin:0 }}>Crear Producto Terminado</h4>
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>

        <form onSubmit={submit} className="form-col" style={{ gap:12 }}>
          <div className="form-row" style={{ gridTemplateColumns:'1fr 1fr' }}>
            <label className="form-field">
              <span>Tipo</span>
              <input
                list="tipos-pt"
                value={tipo}
                onChange={e=>setTipo(e.target.value)}
                placeholder="Ej. Driza"
                required
              />
              <datalist id="tipos-pt">
                {SUG_TIPOS.map(s => <option key={s} value={s} />)}
              </datalist>
            </label>

            <label className="form-field">
              <span>Diámetro</span>
              <input
                list="diam-pt"
                value={diameter}
                onChange={e=>setDiameter(e.target.value)}
                placeholder="Ej. 7/16 o 12mm"
                required
              />
              <datalist id="diam-pt">
                {SUG_DIAM.map(s => <option key={s} value={s} />)}
              </datalist>
            </label>
          </div>

          <label className="form-field">
            <span>Descripción</span>
            <div style={{ display:'flex', gap:8 }}>
              <input
                style={{ flex:1 }}
                value={descripcion}
                onChange={e=>setDescripcion(e.target.value)}
                placeholder="Ej. Driza de Polipropileno 3/16 Blanco"
                required
              />
              <button type="button" className="btn-secondary" onClick={fillSampleDescription}>Sugerir</button>
            </div>
          </label>

          {/* Toggle composición */}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input id="chk-comp" type="checkbox" checked={useComp} onChange={e=>setUseComp(e.target.checked)} />
            <label htmlFor="chk-comp"><strong>Definir composición ahora (opcional)</strong></label>
          </div>

          {useComp && (
            <>
              <div className="muted">Agrega las materias primas, zona y % (el total no debe exceder 100%).</div>
              {rows.map((r, i) => {
                const labelFor = (m) => {
                  const id = m.id || m.ID_PRIMATER
                  const desc = m.descripcion || m.DESCRIPCION || ''
                  const mat = m.material || m.MATERIAL || ''
                  const col = m.color || m.COLOR || ''
                  return { id, text: `${mat}${col ? ' / '+col : ''}${desc ? ' · '+desc : ''}` }
                }
                return (
                  <div key={i} className="form-row" style={{ gridTemplateColumns:'2fr 1fr 1fr auto' }}>
                    <label className="form-field">
                      <span>Materia prima</span>
                      <select value={r.primaterId} onChange={e=>setRow(i,{ primaterId:e.target.value })} required>
                        <option value="">—</option>
                        {materials.map(m => {
                          const { id, text } = labelFor(m)
                          return <option key={id} value={id}>{text}</option>
                        })}
                      </select>
                    </label>

                    <label className="form-field">
                      <span>Zona</span>
                      <select value={r.zone} onChange={e=>setRow(i,{ zone:e.target.value })}>
                        {ZONAS.map(z => <option key={z} value={z}>{z}</option>)}
                      </select>
                    </label>

                    <label className="form-field">
                      <span>%</span>
                      <input type="number" step="0.01" min="0.01" max="100"
                        value={r.percentage}
                        onChange={e=>setRow(i,{ percentage: e.target.value })}
                        required
                      />
                    </label>

                    <div className="form-actions">
                      {rows.length > 0 && (
                        <button type="button" className="btn-secondary" onClick={()=>removeRow(i)}>Quitar</button>
                      )}
                    </div>
                  </div>
                )
              })}

              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <button type="button" className="btn-secondary" onClick={addRow}>+ Agregar MP</button>
                <div className="muted">Total: <strong>{totalPct.toFixed(2)}%</strong> (≤ 100%)</div>
              </div>
            </>
          )}

          {msg && <div className="error">{msg}</div>}

          <div style={{ display:'flex', gap:8, marginTop:6 }}>
            <div style={{ flex:1 }} />
            <button className="btn" disabled={!canCreate || !compOK || sending}>
              {sending ? 'Guardando…' : 'Crear producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
