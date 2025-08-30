// frontend/src/api/payments.js
import api from './axios'

// Lista pagos de un pedido
export const listPaymentsByOrder = (orderId) =>
  api.get(`/api/orders/${orderId}/payments`).then(r => r.data)

// Crea un pago para un pedido
export const createPayment = (orderId, payload) =>
  api.post(`/api/orders/${orderId}/payments`, payload).then(r => r.data)
