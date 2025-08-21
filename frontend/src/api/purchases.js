import api from './axios'

// lista de compras con filtros opcionales { supplierId, from, to, q, page, limit }
export const listPurchases = (params = {}) =>
  api.get('/api/purchases', { params }).then(r => r.data)

export const createPurchase = (payload) =>
  api.post('/api/purchases', payload).then(r => r.data)

// DETALLE de compra + items
export const getPurchase = (id) =>
  api.get(`/api/purchases/${id}`).then(r => r.data)
