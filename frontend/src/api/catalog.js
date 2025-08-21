// src/api/catalog.js
import api from './axios'

// COLORES
export const listColors = () => api.get('/api/colors').then(r=>r.data)
// export const listColors = async () => ([{id:1,name:'Rojo'},{id:2,name:'Azul'}])  // fallback

export const createColor = (name) =>
  api.post('/api/colors', { name }).then(r=>r.data)

// MATERIALES
export const listMaterials = () => api.get('/api/materials').then(r=>r.data)
// export const listMaterials = async () => ([{id:10,name:'Polipropileno'},{id:11,name:'Poliéster'}])

export const createMaterial = (name) =>
  api.post('/api/materials', { name }).then(r=>r.data)
