// Asegúrate de tener este archivo dentro de frontend/src/api/
import api from './axios'

// Lista de clientes (q, limit, offset, activo… como ya usas)
export const fetchCustomers = (params = {}) =>
  api.get('/api/customers', { params }).then(r => r.data)

// Crear cliente
export const createCustomer = (payload) =>
  api.post('/api/customers', payload).then(r => r.data)

// Resumen de cliente (para ClienteDetalle)
export const fetchCustomerSummary = (id, params = {}) =>
  api.get(`/api/customers/${id}`, { params }).then(r => r.data)
