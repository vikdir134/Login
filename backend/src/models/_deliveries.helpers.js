// src/models/_deliveries.helpers.js
import { pool } from '../db.js'

export async function findOrderHeaderById(orderId, conn = pool) {
  const [rows] = await conn.query(
    `SELECT o.ID_ORDER id, o.ID_CUSTOMER customerId, o.FECHA createdAt
     FROM ORDERS o WHERE o.ID_ORDER = ?`, [orderId]
  )
  return rows[0] || null
}

export async function findOrderLine(lineId, conn = pool) {
  const [rows] = await conn.query(
    `SELECT d.ID_DESCRIPTION_ORDER id, d.ID_ORDER orderId, d.ID_PRODUCT productId,
            d.PESO pesoPedido, d.PRESENTACION presentacion
     FROM DESCRIPTION_ORDER d
     WHERE d.ID_DESCRIPTION_ORDER = ?`, [lineId]
  )
  return rows[0] || null
}

export async function getEffectivePrice({ conn = pool, customerId, productId, atDate }) {
  const [rows] = await conn.query(
    `SELECT PRICE, CURRENCY
     FROM CUSTOMER_PRODUCT_PRICES
     WHERE ID_CUSTOMER = ?
       AND ID_PRODUCT = ?
       AND VALID_FROM <= ?
       AND (VALID_TO IS NULL OR VALID_TO > ?)
     ORDER BY VALID_FROM DESC
     LIMIT 1`,
    [customerId, productId, atDate, atDate]
  )
  return rows[0] || null
}
