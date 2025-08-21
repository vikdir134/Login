// frontend/src/api/stock.js
import api from './axios'

// MP por zona (Recepcion/Produccion)
export function fetchPrimaryStock({ zone, limit = 30, offset = 0, q } = {}) {
  return api.get('/api/stock/primary', {
    params: { zone, limit, offset, q }
  }).then(r => r.data)
}

// PT en almacén (agregado por producto+presentación)
export function fetchFinishedStock({ limit = 30, offset = 0, q } = {}) {
  return api.get('/api/stock/finished', {
    params: { limit, offset, q }
  }).then(r => r.data)
}
