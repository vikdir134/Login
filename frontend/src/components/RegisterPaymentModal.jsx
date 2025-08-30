import { useState } from 'react'
import api from '../api/axios'

export default function RegisterPaymentModal({ open, onClose, orderId, currency='PEN', onDone }) {
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0,10))
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('EFECTIVO')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')

  if (!open) return null

  const submit = async (e) => {
    e.preventDefault()
    setMsg(''); setSending(true)
    try {
      await api.post(`/api/orders/${orderId}/payments`, {
        orderId: Number(orderId),
        paymentDate,
        amount: Number(amount),
        method,
        reference: reference || null,
        notes: notes || null,
        currency
      })
      onDone?.()
      onClose?.()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error registrando pago')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="modal modal--center">
      <div className="modal__card" style={{ minWidth: 520 }}>
        <div className="modal__header">
          <h4 style={{ margin:0 }}>Registrar pago</h4>
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>

        <form onSubmit={submit} className="form-col" style={{ gap:10 }}>
          <label className="form-field">
            <span>Fecha</span>
            <input type="date" value={paymentDate} onChange={e=>setPaymentDate(e.target.value)} required />
          </label>
          <label className="form-field">
            <span>Monto ({currency})</span>
            <input type="number" step="0.01" min="0.01" value={amount} onChange={e=>setAmount(e.target.value)} required />
          </label>
          <label className="form-field">
            <span>Método</span>
            <select value={method} onChange={e=>setMethod(e.target.value)}>
              <option value="EFECTIVO">EFECTIVO</option>
              <option value="TRANSFERENCIA">TRANSFERENCIA</option>
              <option value="TARJETA">TARJETA</option>
              <option value="OTRO">OTRO</option>
            </select>
          </label>
          <label className="form-field">
            <span>N° operación / Referencia (opcional)</span>
            <input value={reference} onChange={e=>setReference(e.target.value)} maxLength={100}/>
          </label>
          <label className="form-field">
            <span>Observación (opcional)</span>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={200}/>
          </label>

          {msg && <div className="error">{msg}</div>}
          <div className="form-actions" style={{ justifyContent:'flex-end' }}>
            <button className="btn" disabled={sending}>{sending ? 'Guardando…' : 'Registrar pago'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
