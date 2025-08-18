import { pool } from '../db.js'

export class PaymentsModel {
  static async listByOrder(orderId) {
    const [rows] = await pool.query(
      `SELECT ID_PAYMENT   AS id,
              ID_ORDER     AS orderId,
              PAYMENT_DATE AS paymentDate,
              AMOUNT       AS amount,
              METHOD       AS method,
              REFERENCE    AS reference,
              OBSERVACION  AS notes,
              CURRENCY     AS currency,
              CREATED_BY   AS createdBy,
              CREATED_AT   AS createdAt
       FROM PAYMENTS
       WHERE ID_ORDER = ?
       ORDER BY PAYMENT_DATE DESC, ID_PAYMENT DESC`,
      [orderId]
    )
    return rows
  }

  // ⬇️ Deducimos ID_CUSTOMER desde ORDERS (no hace falta mandarlo en el body)
  static async create({ orderId, paymentDate, amount, method, reference, notes, currency = 'PEN', createdBy = null }) {
    // Traer ID_CUSTOMER del pedido
    const [ord] = await pool.query(
      `SELECT ID_CUSTOMER FROM ORDERS WHERE ID_ORDER = ?`,
      [orderId]
    )
    if (!ord[0]) {
      const e = new Error('Pedido no encontrado')
      e.code = 'ORDER_NOT_FOUND'
      throw e
    }
    const { ID_CUSTOMER } = ord[0]

    // Insertar pago (incluye ID_CUSTOMER si tu tabla lo exige)
    const [res] = await pool.query(
      `INSERT INTO PAYMENTS
       (ID_ORDER, PAYMENT_DATE, AMOUNT, METHOD, REFERENCE, OBSERVACION, CURRENCY, CREATED_BY, ID_CUSTOMER)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, paymentDate, amount, method, reference ?? null, notes ?? null, currency, createdBy, ID_CUSTOMER]
    )

    const [rows] = await pool.query(
      `SELECT ID_PAYMENT   AS id,
              ID_ORDER     AS orderId,
              PAYMENT_DATE AS paymentDate,
              AMOUNT       AS amount,
              METHOD       AS method,
              REFERENCE    AS reference,
              OBSERVACION  AS notes,
              CURRENCY     AS currency,
              CREATED_BY   AS createdBy,
              CREATED_AT   AS createdAt
       FROM PAYMENTS WHERE ID_PAYMENT = ?`,
      [res.insertId]
    )
    return rows[0]
  }
}
