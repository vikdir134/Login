// src/api/orders.js
import api from './axios'

// lista con filtros
export const listOrders = (params = {}) =>
  api.get('/api/orders', { params }).then(r => r.data)

export const fetchOrder = (id) =>
  api.get(`/api/orders/${id}`).then(r => r.data)

export const createOrderApi = (payload) =>
  api.post('/api/orders', payload).then(r => r.data)

export const changeOrderStateApi = (id, state) =>
  api.patch(`/api/orders/${id}/state`, { state }).then(r => r.data)

export const addOrderLine = (orderId, { productId, peso, presentacion }) =>
  api.post(`/api/orders/${orderId}/lines`, { productId, peso, presentacion }).then(r=>r.data)

export const updateOrderLine = (orderId, lineId, patch) =>
  api.patch(`/api/orders/${orderId}/lines/${lineId}`, patch).then(r=>r.data)

export const deleteOrderLine = (orderId, lineId) =>
  api.delete(`/api/orders/${orderId}/lines/${lineId}`).then(r=>r.data)

export const cancelOrder = (orderId) =>
  api.post(`/api/orders/${orderId}/cancel`).then(r=>r.data)

export const reactivateOrder = (orderId) =>
  api.post(`/api/orders/${orderId}/reactivate`).then(r=>r.data)

export const listOrdersInProcess = (params={}) =>
  api.get('/api/orders/in-process', { params }).then(r=>r.data)

// ⚠️ ELIMINA el uso de /api/orders/pending en el front.
// Si lo quieres mantener, crea el endpoint en backend. Si no, usa esta nueva función:

// 👉 Activos = PENDIENTE + EN_PROCESO vía endpoint general
export const listOrdersActive = (params = {}) =>
  listOrders({ ...params, state: 'PENDIENTE,EN_PROCESO' })
export const listOrdersCombined = (params = {}) =>
  api.get('/api/orders/search', { params }).then(r => r.data)