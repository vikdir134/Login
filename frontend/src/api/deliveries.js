

import api from './axios'

export const fetchDeliveriesByOrder = (orderId) =>
  api.get(`/api/orders/${orderId}/deliveries`).then(r => r.data)

export const createDelivery = (orderId, payload) =>
  api.post('/api/deliveries', { orderId: Number(orderId), ...payload }).then(r => r.data)
