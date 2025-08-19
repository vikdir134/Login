import api from './axios'

export async function fetchDeliveriesByOrder(orderId) {
  const { data } = await api.get(`/api/orders/${orderId}/deliveries`)
  return data
}

export async function createDelivery(orderId, payload) {
  const { data } = await api.post(`/api/orders/${orderId}/deliveries`, payload)
  return data
}
