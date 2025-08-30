// frontend/src/api/customers.js
import api from './axios'

// Lista de clientes (con paginación y búsqueda)
export const fetchCustomers = (params = {}) =>
  api.get('/api/customers', { params }).then(r => r.data)

// Crear cliente
export const createCustomer = (payload) =>
  api.post('/api/customers', payload).then(r => r.data)

// 🔹 Resumen (KPIs + pedidos con totales) — usa /:id/summary
// params opcionales: { states: 'PENDIENTE,EN_PROCESO', from:'YYYY-MM-DD', to:'YYYY-MM-DD', limit, offset }
export const fetchCustomerSummary = (id, params = {}) =>
  api.get(`/api/customers/${id}/summary`, { params }).then(r => r.data)

// 🔹 Detalle básico (por si alguna vista aún lo usa)
export const fetchCustomerDetail = (id) =>
  api.get(`/api/customers/${id}`).then(r => r.data)

// (Opcional) helper por si quieres normalizar la respuesta de lista a {items,total}
export const fetchCustomersNormalized = async (params = {}) => {
  const data = await fetchCustomers(params)
  if (Array.isArray(data)) {
    // backend antiguo sin total
    return { items: data, total: data.length }
  }
  return { items: data?.items ?? [], total: Number(data?.total || 0) }
}
