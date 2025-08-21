// frontend/src/components/MoveMPModal.jsx
import { useEffect, useMemo, useState } from 'react'
import { movePrimary, fetchPrimaryMaterialsLite } from '../api/stock'

export default function MoveMPModal({ open, onClose, onDone, defaultFrom }) {
  const [from, setFrom] = useState(defaultFrom || 'RECEPCION')
  const [to, setTo] = useState(from === 'RECEPCION' ? 'PRODUCCION' : 'RECEPCION')
  const [materials, setMaterials] = useState([])
  const [primaterId, setPrimaterId] = useState('')
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!open) return
    const f = defaultFrom || 'RECEPCION'
    setFrom(f); setTo(f === 'RECEPCION' ? 'PRODUCCION' : 'RECEPCION')
    setPrimaterId(''); setQty(''); setNote(''); setMsg(''); setQ('')
    fetchPrimaryMaterialsLite(1000).then(setMaterials).catch(()=>setMaterials([]))
  }, [open, defaultFrom])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return materials
    return materials.filter(m =>
      (m.descripcion || m.DESCRIPCION || '').toLowerCase().includes(t) ||
      (m.material || m.MATERIAL || '').toLowerCase().includes(t) ||
      (m.color || m.COLOR || '').toLowerCase().includes(t)
    )
  }, [materials, q])

  const canSubmit = ['RECEPCION','PRODUCCION'].includes(from) &&
                    ['RECEPCION','PRODUCCION'].includes(to) &&
                    from !== to && Number(primaterId) > 0 && Number(qty) > 0

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSending(true); setMsg('')
    try {
      await movePrimary({ from, to, primaterId: Number(primaterId), qty: Number(qty), note: note || null })
      onDone?.(); onClose?.()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error moviendo MP')
    } finally { setSending(false) }
  }

  if (!open) return null
  return (
    <div className="modal modal--center">
      <div className="modal__card">
        <div className="modal__header">
          <h4 style={{ margin:0 }}>Mover Materia Prima</h4>
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
        <form onSubmit={submit} className="form-col" style={{ gap:12 }}>
          <div className="form-row">
            <label className="form-field">
              <span>De</span>
              <select value={from} onChange={e=>setFrom(e.target.value)}>
                <option value="RECEPCION">RECEPCION</option>
                <option value="PRODUCCION">PRODUCCION</option>
              </select>
            </label>
            <label className="form-field">
              <span>A</span>
              <select value={to} onChange={e=>setTo(e.target.value)}>
                <option value="PRODUCCION">PRODUCCION</option>
                <option value="RECEPCION">RECEPCION</option>
              </select>
            </label>
          </div>

          <label className="form-field">
            <span>Buscar materia prima</span>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rafia / PP / Blanco…" />
          </label>

          <label className="form-field">
            <span>Materia Prima</span>
            <select value={primaterId} onChange={e=>setPrimaterId(e.target.value)} required>
              <option value="">—</option>
              {filtered.map(m => {
                const id = m.id || m.ID_PRIMATER
                const desc = m.descripcion || m.DESCRIPCION || ''
                const mat = m.material || m.MATERIAL || ''
                const col = m.color || m.COLOR || ''
                return <option key={id} value={id}>{`${mat}${col ? ' / '+col : ''}${desc ? ' · '+desc : ''}`}</option>
              })}
            </select>
          </label>

          <label className="form-field">
            <span>Cantidad (kg)</span>
            <input type="number" step="0.01" min="0.01" value={qty} onChange={e=>setQty(e.target.value)} required />
          </label>

          <label className="form-field">
            <span>Nota (opcional)</span>
            <input value={note} onChange={e=>setNote(e.target.value)} />
          </label>

          {msg && <div className="error">{msg}</div>}
          <div className="form-actions" style={{ justifyContent:'flex-end' }}>
            <button className="btn" disabled={!canSubmit || sending}>{sending ? 'Moviendo…' : 'Mover'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
