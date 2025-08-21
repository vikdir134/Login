import api from './axios'

// === EXISTENTES (por si faltaba alguna) ===
export const fetchSpaces = (tipo) =>
  api.get('/api/catalog/spaces', { params: { tipo } }).then(r => r.data)

export const fetchPrimaryMaterials = () =>
  api.get('/api/catalog/primary-materials', { params: { limit: 1000 } }).then(r => r.data)



export const fetchPresentations = (productId) =>
  api.get(`/api/product-presentations/${productId}`).then(r => r.data)


export const inputFinishedProduct = (payload) =>
  api.post('/api/stock/finished/input', payload).then(r => r.data)

// === NUEVO: Ingresar MP en RECEPCION ===
export const inputPrimaryMaterial = (payload) =>
  api.post('/api/stock/primary/input', payload).then(r => r.data)

// === NUEVO: Catálogos básicos (materiales y colores) ===
export const createMaterial = (payload) =>
  api.post('/api/catalog/materials', payload).then(r => r.data)

export const createColor = (payload) =>
  api.post('/api/catalog/colors', payload).then(r => r.data)

export const createPrimaryMaterial = (payload) =>
  api.post('/api/catalog/primary-materials', payload).then(r => r.data)
// src/api/stock.js

export const fetchProducts = () =>
  api.get('/api/catalog/products', { params: { limit: 1000 } }).then(r => r.data)

export const createPresentation = ({ productId, presentationKg }) =>
  api.post('/api/product-presentations', {
    productId: Number(productId),
    presentationKg: Number(presentationKg)
  }).then(r => r.data)
