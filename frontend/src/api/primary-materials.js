// src/api/primaryMaterials.js (catálogo de MATERIA PRIMA “primaria” / PRIMARY_MATERIALS)
import api from './axios'

export const listPrimaryMaterials = () =>
  api.get('/api/primary-materials').then(r=>r.data)

export const createPrimaryMaterial = (payload) =>
  api.post('/api/primary-materials', payload).then(r=>r.data)
// payload: { materialId, colorId|null, descripcion, denier }
