

import api from './axios'
export const listDeliveries = (params = {}) =>
  api.get('/api/deliveries', { params }).then(r => r.data)

export const fetchDeliveriesByOrder = (orderId) =>
  api.get(`/api/orders/${orderId}/deliveries`).then(r => r.data)

export const createDelivery = (orderId, payload) =>
  api.post('/api/deliveries', { orderId: Number(orderId), ...payload }).then(r => r.data)