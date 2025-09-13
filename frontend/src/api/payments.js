// frontend/src/api/payments.js
import api from './axios'

// =================== NUEVO ===================

// (Opcional) Pagos por FACTURA
export const listPaymentsByInvoice = (facturaId) =>
  api.get(`/api/payments/invoice/${facturaId}`).then(r => r.data)

// =================== LEGACY ==================
// Pagos por PEDIDO (para compatibilidad con pantallas viejas)
export const listPaymentsByOrder = (orderId) =>
  api.get(`/api/orders/${orderId}/payments`).then(r => r.data)

export const createPaymentForOrder = (orderId, payload) =>
  api.post(`/api/orders/${orderId}/payments`, payload).then(r => r.data)


export const listPaymentsByDelivery = (deliveryId) => api.get(`/api/deliveries/${deliveryId}/payments`).then(r => r.data)
export const createPayment = (payload) => api.post(`/api/deliveries/${payload.orderDeliveryId}/payments`, payload).then(r => r.data)
