// src/api/stock.js
import api from './axios'

// zonas (si ya tienes SPACES)
export const listZones = () => api.get('/api/zones').then(r=>r.data)
// export const listZones = async () => (
//   [{id:1,name:'RECEPCION'},{id:2,name:'ALMACEN_PRINCIPAL'},{id:3,name:'PT_ALMACEN'},{id:4,name:'MERMA'}]
// )

// agregar stock de MP
export const addPrimaryStock = (payload) =>
  api.post('/api/stock/primary', payload).then(r=>r.data)
// { primaterId, zoneId, peso, observacion }

// agregar stock de PT
export const addFinishedStock = (payload) =>
  api.post('/api/stock/finished', payload).then(r=>r.data)
// { productId, zoneId, peso, observacion }

// mover entre zonas
export const moveStock = (payload) =>
  api.post('/api/stock/move', payload).then(r=>r.data)
// { type: 'PRIMARY'|'FINISHED', itemId, fromZoneId, toZoneId, peso, observacion }
