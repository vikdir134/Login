// src/api/products.js
import api from './axios'

export const listProducts = () =>
  api.get('/api/products').then(r=>r.data)

export async function createProduct({ tipo, diameter, descripcion }) {
  const { data } = await api.post('/api/products', { tipo, diameter, descripcion })
  return data // { id, tipo, diameter, descripcion }
}

export const addCompositions = (productId, items) =>
  api.post(`/api/products/${productId}/composition`, { items }).then(r=>r.data)
// items: [{ primaterId, zone, percentage }]

export async function setProductComposition(productId, items) {
  const { data } = await api.put(`/api/products/${productId}/composition`, { items })
  return data // { ok, count }
}