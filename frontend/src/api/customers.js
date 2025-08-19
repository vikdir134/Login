import api from './axios'

export async function fetchCustomers({ q = '', active = '', limit = 50, offset = 0 } = {}) {
  const p = new URLSearchParams()
  if (q) p.set('q', q)
  if (active !== '') p.set('active', active)
  p.set('limit', limit)
  p.set('offset', offset)
  const { data } = await api.get(`/api/customers?${p.toString()}`)
  return data
}

export async function fetchCustomerSummary(id) {
  const { data } = await api.get(`/api/customers/${id}`)
  return data
}
