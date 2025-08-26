import api from './axios'
export async function createInvoice({ customerId, code }) {
  const { data } = await api.post('/api/invoices', { customerId, code })
  return data // { id, ... }
}
