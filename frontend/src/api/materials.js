// src/api/materials.js
import api from './axios'

// TODO: conectar a tu backend real
export const listMaterials = () =>
  api.get('/api/materials').then(r => r.data)
// Fallback temporal si el endpoint no existe todavía:
// export const listMaterials = async () => ([
//   { id: 10, name: 'Polipropileno' },
//   { id: 11, name: 'Poliéster' }
// ])

export const listColors = () =>
  api.get('/api/colors').then(r => r.data)
// Fallback temporal:
// export const listColors = async () => ([
//   { id: 20, name: 'Rojo' },
//   { id: 21, name: 'Azul' }
// ])

export const createPrimaryMaterial = (payload) =>
  api.post('/api/primary-materials', payload).then(r => r.data)
// payload esperado (ej.):
// { materialId: 10, colorId: 21|null, descripcion: 'Granulado', denier: 600 }
