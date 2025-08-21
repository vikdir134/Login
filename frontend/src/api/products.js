// src/api/products.js
import api from './axios'

export const listProducts = () =>
  api.get('/api/products').then(r=>r.data)

export const createProduct = (payload) =>
  api.post('/api/products', payload).then(r=>r.data)
// { tipoProducto, diameter, descripcion }

export const addCompositions = (productId, items) =>
  api.post(`/api/products/${productId}/composition`, { items }).then(r=>r.data)
// items: [{ primaterId, zone, percentage }]
