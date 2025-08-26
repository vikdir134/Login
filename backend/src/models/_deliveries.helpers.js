// src/models/_deliveries.helpers.js
import { pool } from '../db.js'

// Cabecera de pedido
export async function findOrderHeaderById(orderId, conn = pool) {
  const [rows] = await conn.query(
    `SELECT o.ID_ORDER   AS id,
            o.ID_CUSTOMER AS customerId
       FROM ORDERS o
      WHERE o.ID_ORDER = ?
      LIMIT 1`,
    [orderId]
  )
  return rows[0] || null
}

// Línea de pedido (devuelve producto y PRESENTACION)
// src/models/_deliveries.helpers.js (fragmento sugerido)
export async function findOrderLine(descriptionOrderId, conn) {
  const [[row]] = await conn.query(
    `SELECT d.ID_DESCRIPTION_ORDER     AS id,
            d.ID_ORDER                 AS orderId,
            d.ID_PRODUCT               AS productId,
            d.PESO                     AS pesoPedido,
            d.PRESENTACION             AS presentacion   -- <- TEXTO AQUÍ
       FROM DESCRIPTION_ORDER d
      WHERE d.ID_DESCRIPTION_ORDER = ?`,
    [descriptionOrderId]
  )
  return row || null
}
