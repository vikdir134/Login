// frontend/src/api/receivables.js
import api from './axios'

// Lista de clientes con KPI de deuda
export const listReceivableCustomers = (params = {}) =>
  api.get('/api/receivables/customers', { params }).then(r => r.data)

// Detalle por cliente (pedidos con total, pagado, saldo, facturas)
export const fetchCustomerReceivable = (customerId, params = {}) =>
  api.get(`/api/receivables/customers/${customerId}`, { params }).then(r => r.data)

// Resumen global
export const fetchReceivablesSummary = () =>
  api.get('/api/receivables/summary').then(r => r.data)
