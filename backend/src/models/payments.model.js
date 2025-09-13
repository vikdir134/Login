// backend/src/models/payments.model.js
import { pool } from '../db.js'

async function getDeliveryContext(orderDeliveryId) {
  const [rows] = await pool.query(
    `SELECT
       od.ID_ORDER_DELIVERY AS orderDeliveryId,
       od.ID_ORDER          AS orderId,
       od.ID_FACTURA        AS facturaId,
       o.ID_CUSTOMER        AS customerId
     FROM ORDER_DELIVERY od
     JOIN ORDERS o ON o.ID_ORDER = od.ID_ORDER
     WHERE od.ID_ORDER_DELIVERY = ?`,
    [Number(orderDeliveryId)]
  )
  return rows[0] || null
}

export const PaymentsModel = {
  async listByDelivery(orderDeliveryId) {
    const [rows] = await pool.query(
      `SELECT
         ID_PAYMENT        AS id,
         ID_ORDER          AS orderId,
         ID_ORDER_DELIVERY AS orderDeliveryId,
         ID_FACTURA        AS facturaId,
         ID_CUSTOMER       AS customerId,
         PAYMENT_DATE      AS paymentDate,
         AMOUNT            AS amount,
         CURRENCY          AS currency,
         METHOD            AS method,
         REFERENCE         AS reference,
         OBSERVACION       AS notes,
         CREATED_BY        AS createdBy,
         CREATED_AT        AS createdAt
       FROM PAYMENTS
       WHERE ID_ORDER_DELIVERY = ?
       ORDER BY PAYMENT_DATE DESC, ID_PAYMENT DESC`,
      [Number(orderDeliveryId)]
    )
    return rows
  },

  /**
   * Crea un pago LIGADO a una ENTREGA.
   * - orderDeliveryId: requerido
   * - facturaId: opcional (si no viene, usamos la factura de la entrega si existe)
   * - Completa automáticamente: ID_ORDER y ID_CUSTOMER desde la entrega.
   */
  async create({
    orderDeliveryId,
    facturaId = null,
    paymentDate,
    amount,
    method,
    reference = null,
    notes = null,
    currency = 'PEN',
    createdBy = null,
  }) {
    const ctx = await getDeliveryContext(orderDeliveryId)
    if (!ctx) {
      const e = new Error('Entrega no encontrada')
      e.code = 'DELIVERY_NOT_FOUND'
      throw e
    }

    const finalFacturaId = facturaId ?? ctx.facturaId ?? null

    const [res] = await pool.query(
      `INSERT INTO PAYMENTS
         (ID_ORDER, ID_ORDER_DELIVERY, ID_FACTURA, ID_CUSTOMER,
          PAYMENT_DATE, AMOUNT, CURRENCY, METHOD, REFERENCE, OBSERVACION,
          CREATED_BY, CREATED_AT)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        ctx.orderId,
        orderDeliveryId,
        finalFacturaId,
        ctx.customerId,
        paymentDate,
        amount,
        currency || 'PEN',
        method,
        reference,
        notes,
        createdBy,
      ]
    )

    const [rows] = await pool.query(
      `SELECT
         ID_PAYMENT        AS id,
         ID_ORDER          AS orderId,
         ID_ORDER_DELIVERY AS orderDeliveryId,
         ID_FACTURA        AS facturaId,
         ID_CUSTOMER       AS customerId,
         PAYMENT_DATE      AS paymentDate,
         AMOUNT            AS amount,
         CURRENCY          AS currency,
         METHOD            AS method,
         REFERENCE         AS reference,
         OBSERVACION       AS notes,
         CREATED_BY        AS createdBy,
         CREATED_AT        AS createdAt
       FROM PAYMENTS
       WHERE ID_PAYMENT = ?`,
      [res.insertId]
    )
    return rows[0] || { id: res.insertId }
  },
}
