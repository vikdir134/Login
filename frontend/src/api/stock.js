// frontend/src/api/stock.js
import api from './axios'

// ===== LISTADOS =====
export function fetchPrimaryStock({ zone, limit = 30, offset = 0, q } = {}) {
  return api.get('/api/stock/primary', {
    params: { zone, limit, offset, q }
  }).then(r => r.data) // {items, total}
}

export function fetchFinishedStock({ limit = 30, offset = 0, q } = {}) {
  return api.get('/api/stock/finished', {
    params: { limit, offset, q }
  }).then(r => r.data) // {items, total}
}

// Merma (stock/historial simple agregada)
// Si tu backend expone otra ruta, ajusta el path aquí:
export function fetchMerma({ limit = 30, offset = 0, q } = {}) {
  return api.get('/api/stock/merma', { params: { limit, offset, q } })
    .then(r => r.data) // {items, total}
}

// ===== ACCIONES =====
export function createFinishedInput(payload) {
  // POST /api/stock/finished/input
  return api.post('/api/stock/finished/input', payload).then(r => r.data)
}

export function movePrimary({ from, to, primaterId, qty, note }) {
  // POST /api/stock/primary/move
  return api.post('/api/stock/primary/move', { from, to, primaterId, qty, note }).then(r => r.data)
}

// Agregar merma desde cualquier zona
// body sugerido: { sourceType:'PRIMARY'|'FINISHED', sourceZone:'RECEPCION'|'PRODUCCION'|'ALMACEN', itemId, qty, note? }
export function addMerma(payload) {
  return api.post('/api/stock/merma/add', payload).then(r => r.data)
}

// Catálogos livianos
export function fetchProductsLite(limit = 1000) {
  return api.get('/api/catalog/products', { params: { limit } }).then(r => r.data)
}
export function fetchPresentations(productId) {
  return api.get('/api/product-presentations', { params: { productId } }).then(r => r.data)
}
export function fetchPrimaryMaterialsLite(limit = 1000) {
  return api.get('/api/primary-materials', { params: { limit } }).then(r => r.data)
}
export async function deleteMerma(id) {
  const { data } = await api.delete(`/api/stock/merma/${id}`)
  return data
}
// DESCARTAR merma (por cantidad)
export async function removeMerma(payload) {
  // payload: { type: 'PRIMARY'|'FINISHED', itemId:number, qty:number, note?:string }
  const { data } = await api.post('/api/stock/merma/remove', payload)
  return data
}
export const fetchFinishedSummary = (params) =>
  api.get('/api/stock/finished/summary', { params }).then(r => r.data)

export const fetchFinishedByProduct = (productId) =>
  api.get('/api/stock/finished/by-product', { params:{ productId } }).then(r => r.data)

