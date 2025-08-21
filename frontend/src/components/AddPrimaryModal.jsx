import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import {
  fetchSpaces, fetchPrimaryMaterials,
  inputPrimaryMaterial, createPrimaryMaterial
} from '../api/stock'

export default function AddPrimaryModal({ open, onClose, onDone }) {
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [spaces, setSpaces] = useState([])    // RECEPCION
  const [primaries, setPrimaries] = useState([])

  const [form, setForm] = useState({
    zoneId: '',          // zona RECEPCION
    primaterId: '',      // MP existente
    peso: '',
    observacion: ''
  })

  // soporte: crear MP en caliente
  const [showCreatePM, setShowCreatePM] = useState(false)
  const [pmDraft, setPmDraft] = useState({ materialId: '', colorId: '', denier: '', descripcion: '' })

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    Promise.all([
      fetchSpaces('RECEPCION').catch(()=>[]),
      fetchPrimaryMaterials().catch(()=>[])
    ]).then(([zs, pms]) => {
      if (!alive) return
      setSpaces(zs || [])
      setPrimaries(pms || [])
      setMsg('')
    }).catch(() => setMsg('No se pudieron cargar catálogos'))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [open])

  const canSubmit = useMemo(
    () => !!form.zoneId && !!form.primaterId && Number(form.peso) > 0,
    [form]
  )

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setMsg('')
    try {
      await inputPrimaryMaterial({
        zoneId: Number(form.zoneId),
        primaterId: Number(form.primaterId),
        peso: Number(form.peso),
        observacion: form.observacion || null
      })
      onDone?.()
      onClose()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error al ingresar materia prima')
    }
  }

  const submitCreatePM = async () => {
    setMsg('')
    try {
      const payload = {
        materialId: Number(pmDraft.materialId),
        colorId: pmDraft.colorId ? Number(pmDraft.colorId) : undefined,
        denier: pmDraft.denier ? Number(pmDraft.denier) : undefined,
        descripcion: pmDraft.descripcion?.trim() || undefined
      }
      const created = await createPrimaryMaterial(payload)
      // refrescar catálogo y seleccionar
      const list = await fetchPrimaryMaterials()
      setPrimaries(list)
      setForm(f => ({ ...f, primaterId: created?.id?.toString?.() || '' }))
      setShowCreatePM(false)
      setMsg('✅ Materia prima creada')
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error creando materia prima')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Agregar Materia Prima (Recepción)">
      {loading ? <div className="muted">Cargando…</div> : (
        <form onSubmit={submit} style={{ display:'grid', gap:12 }}>
          <div className="grid-3">
            <label>
              Zona (Recepción)
              <select
                value={form.zoneId}
                onChange={e => setForm(f => ({ ...f, zoneId: e.target.value }))}
                required
              >
                <option value="">—</option>
                {spaces.map(z => <option key={z.id} value={z.id}>{z.NOMBRE || z.name || `Recepción #${z.id}`}</option>)}
              </select>
            </label>

            <label>
              Materia Prima
              <div style={{ display:'flex', gap:8 }}>
                <select
                  value={form.primaterId}
                  onChange={e => setForm(f => ({ ...f, primaterId: e.target.value }))}
                  required
                  style={{ flex:1 }}
                >
                  <option value="">—</option>
                  {primaries.map(pm => (
                    <option key={pm.ID_PRIMATER || pm.id} value={pm.ID_PRIMATER || pm.id}>
                      {pm.DESCRIPCION || pm.name || `MP #${pm.id}`}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn-secondary" onClick={()=>setShowCreatePM(true)}>+ Nueva</button>
              </div>
            </label>

            <label>
              Peso (kg)
              <input
                type="number" step="0.01" min="0.01"
                value={form.peso}
                onChange={e => setForm(f => ({ ...f, peso: e.target.value }))}
                required
              />
            </label>
          </div>

          <label>
            Observación (opcional)
            <input value={form.observacion} onChange={e=>setForm(f=>({ ...f, observacion: e.target.value }))} />
          </label>

          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn" disabled={!canSubmit}>Guardar</button>
          </div>

          {msg && <div className="muted" style={{ marginTop:8 }}>{msg}</div>}

          {showCreatePM && (
            <div className="card" style={{ marginTop:8 }}>
              <strong>Nueva Materia Prima</strong>
              <div className="grid-3" style={{ marginTop:8 }}>
                <label>
                  Material (ID)
                  <input type="number" min="1" value={pmDraft.materialId}
                         onChange={e=>setPmDraft(d=>({ ...d, materialId: e.target.value }))} />
                </label>
                <label>
                  Color (ID)
                  <input type="number" min="1" value={pmDraft.colorId}
                         onChange={e=>setPmDraft(d=>({ ...d, colorId: e.target.value }))} />
                </label>
                <label>
                  Denier (opcional)
                  <input type="number" min="0" value={pmDraft.denier}
                         onChange={e=>setPmDraft(d=>({ ...d, denier: e.target.value }))} />
                </label>
              </div>
              <label>
                Descripción
                <input value={pmDraft.descripcion}
                       onChange={e=>setPmDraft(d=>({ ...d, descripcion: e.target.value }))} />
              </label>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={()=>setShowCreatePM(false)}>Cerrar</button>
                <button type="button" className="btn" onClick={submitCreatePM}>Crear MP</button>
              </div>
            </div>
          )}
        </form>
      )}
    </Modal>
  )
}
