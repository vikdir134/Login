import api from './axios'

export async function fetchOrders(params = {}) {
  const p = new URLSearchParams()
  if (params.customerId) p.set('customerId', params.customerId)
  if (params.state) p.set('state', params.state)
  if (params.from) p.set('from', params.from)
  if (params.to) p.set('to', params.to)
  const { data } = await api.get(`/api/orders?${p.toString()}`)
  return data
}

export async function fetchOrder(id) {
  const { data } = await api.get(`/api/orders/${id}`)
  return data
}
