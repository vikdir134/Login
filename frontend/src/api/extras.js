// frontend/src/api/extras.js
import api from './axios'

export const createColor = (name) => api.post('/api/colors', { name }).then(r=>r.data)
export const createMaterial = (name) => api.post('/api/materials', { name }).then(r=>r.data)
export const createPresentation = ({ productId, presentationKg }) =>
  api.post('/api/product-presentations', { productId, presentationKg }).then(r=>r.data)

export const fetchProductsLite = (limit=1000) =>
  api.get('/api/catalog/products', { params:{ limit }}).then(r=>r.data)
