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

export const addOrderLine = (orderId, { productId, peso, presentacion }) =>
  api.post(`/api/orders/${orderId}/lines`, { productId, peso, presentacion }).then(r=>r.data)

// NUEVO: actualizar línea
export const updateOrderLine = (orderId, lineId, patch) =>
  api.patch(`/api/orders/${orderId}/lines/${lineId}`, patch).then(r=>r.data)

// NUEVO: eliminar línea
export const deleteOrderLine = (orderId, lineId) =>
  api.delete(`/api/orders/${orderId}/lines/${lineId}`).then(r=>r.data)

// NUEVO: cancelar pedido
export const cancelOrder = (orderId) =>
  api.post(`/api/orders/${orderId}/cancel`).then(r=>r.data)

// NUEVO: reactivar pedido (el backend recalcula estado: PENDIENTE/EN_PROCESO/ENTREGADO)
export const reactivateOrder = (orderId) =>
  api.post(`/api/orders/${orderId}/reactivate`).then(r=>r.data)