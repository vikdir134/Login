// frontend/src/api/receivables.js
import api from './axios'

export async function listReceivableCustomers({ q, balance = 'all', limit = 30, offset = 0 }) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (balance) params.set('balance', balance) // all | with | without
  if (limit != null) params.set('limit', limit)
  if (offset != null) params.set('offset', offset)
  const { data } = await api.get(`/api/receivables/customers?${params.toString()}`)
  return data
}

export async function fetchReceivablesSummary() {
  const { data } = await api.get('/api/receivables/summary')
  return data
}
// Detalle por cliente (pedidos con total, pagado, saldo, facturas)
export const fetchCustomerReceivable = (customerId, params = {}) =>
  api.get(`/api/receivables/customers/${customerId}`, { params }).then(r => r.data)

