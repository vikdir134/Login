// src/api/orders.js
import api from './axios'

// lista con filtros
export const listOrders = (params = {}) =>
  api.get('/api/orders', { params }).then(r => r.data)

// detalle
export const fetchOrder = (id) =>
  api.get(`/api/orders/${id}`).then(r => r.data)

// crear
export const createOrderApi = (payload) =>
  api.post('/api/orders', payload).then(r => r.data)

// cambiar estado
export const changeOrderStateApi = (id, state) =>
  api.patch(`/api/orders/${id}/state`, { state }).then(r => r.data)
