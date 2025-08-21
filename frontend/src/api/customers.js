import api from './axios'

// lista
export const fetchCustomers = (params = {}) =>
  api.get('/api/customers', { params }).then(r => r.data)

// detalle (devuelve { customer, orders })
export const fetchCustomerDetail = (id) =>
  api.get(`/api/customers/${id}`).then(r => r.data)
