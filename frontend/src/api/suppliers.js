// src/api/suppliers.js
import api from './axios'

// listar
export const listSuppliers = (params = {}) =>
  api.get('/api/suppliers', { params }).then(r => r.data)

// crear
export const createSupplier = (payload) =>
  api.post('/api/suppliers', payload).then(r => r.data)
