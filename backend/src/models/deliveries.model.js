// src/models/deliveries.model.js
import { pool } from '../db.js'
import { markOrderDeliveredIfComplete } from './orders.model.js'

// Helpers que aceptan una conexión (conn) para leer dentro de la misma TX
async function findOrderHeaderById(conn, orderId) {
  const [rows] = await conn.query(
    `SELECT o.ID_ORDER AS id, o.ID_CUSTOMER AS customerId, o.FECHA AS createdAt
     FROM ORDERS o WHERE o.ID_ORDER = ?`,
    [orderId]
  )
  return rows[0] || null
}

async function findOrderLine(conn, lineId) {
  const [rows] = await conn.query(
    `SELECT d.ID_DESCRIPTION_ORDER AS id, d.ID_ORDER AS orderId, d.ID_PRODUCT AS productId,
            d.PESO AS pesoPedido, d.PRESENTACION AS presentacion
     FROM DESCRIPTION_ORDER d
     WHERE d.ID_DESCRIPTION_ORDER = ?`,
    [lineId]
  )
  return rows[0] || null
}

// Precio vigente por cliente+producto en una fecha (VALID_FROM <= fecha < VALID_TO o VALID_TO IS NULL)
async function getEffectivePrice(conn, { customerId, productId, atDate }) {
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

export class DeliveriesModel {
  // Retorna header + lines creadas
  static async create({ orderId, facturaId = null, fecha, createdBy = null, lines }) {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      // Validación básica de pedido (dentro de la misma TX)
      const head = await findOrderHeaderById(conn, orderId)
      if (!head) {
        const err = new Error('Pedido no existe')
        err.code = 'ORDER_NOT_FOUND'
        throw err
      }

      // Crear cabecera de entrega
      const [resHead] = await conn.query(
        `INSERT INTO ORDER_DELIVERY (ID_ORDER, ID_FACTURA, FECHA, CREATED_BY)
         VALUES (?, ?, ?, ?)`,
        [orderId, facturaId, fecha, createdBy]
      )
      const deliveryId = resHead.insertId

      const createdLines = []
      for (const l of lines) {
        // Validar línea de pedido (debe pertenecer al mismo orderId)
        const ol = await findOrderLine(conn, l.descriptionOrderId)
        if (!ol || ol.orderId !== orderId) {
          const err = new Error('Línea de pedido inválida')
          err.code = 'ORDER_LINE_INVALID'
          throw err
        }

        // Determinar UNIT_PRICE
        let unitPrice = l.unitPrice
        let currency = 'PEN'
        if (unitPrice === undefined || unitPrice === null) {
          const eff = await getEffectivePrice(conn, {
            customerId: head.customerId,
            productId: ol.productId,
            atDate: (fecha?.split?.(' ')?.[0]) || fecha // por si viene 'YYYY-MM-DD hh:mm:ss'
          })
          if (!eff) {
            const err = new Error('No hay precio vigente para el producto de esta línea en la fecha de entrega')
            err.code = 'NO_EFFECTIVE_PRICE'
            throw err
          }
          unitPrice = Number(eff.PRICE)
          currency = eff.CURRENCY || 'PEN'
        }

        // Insertar línea
        await conn.query(
          `INSERT INTO DESCRIPTION_DELIVERY
            (ID_ORDER_DELIVERY, ID_DESCRIPTION_ORDER, PESO, DESCRIPCION, UNIT_PRICE, CURRENCY)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [deliveryId, l.descriptionOrderId, l.peso, l.descripcion ?? null, unitPrice, currency]
        )

        createdLines.push({
          descriptionOrderId: l.descriptionOrderId,
          peso: Number(l.peso),
          unitPrice: Number(unitPrice),
          currency
          // SUBTOTAL se calcula por columna generada en la BD
        })
      }

      await conn.commit()

      // Intentar actualizar estado del pedido si ya se completó
      await markOrderDeliveredIfComplete(orderId)

      // Resumen simple (fuera de la TX vale usar pool)
      const [sumRows] = await pool.query(
        `SELECT COUNT(*) AS lineCount, IFNULL(SUM(SUBTOTAL),0) AS monto
         FROM DESCRIPTION_DELIVERY WHERE ID_ORDER_DELIVERY = ?`,
        [deliveryId]
      )

      return {
        id: deliveryId,
        orderId,
        facturaId,
        fecha,
        lineCount: Number(sumRows[0].lineCount),
        totalEntregado: Number(sumRows[0].monto),
        lines: createdLines
      }
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }

  static async listByOrder(orderId) {
    const [rows] = await pool.query(
      `SELECT
         od.ID_ORDER_DELIVERY  AS deliveryId,
         od.FECHA              AS fecha,
         od.ID_FACTURA         AS facturaId,
         dd.ID_DESCRIPTION_DELIVERY AS lineId,
         dd.ID_DESCRIPTION_ORDER    AS descriptionOrderId,
         dd.PESO               AS peso,
         dd.UNIT_PRICE         AS unitPrice,
         dd.SUBTOTAL           AS subtotal,
         dd.CURRENCY           AS currency
       FROM ORDER_DELIVERY od
       JOIN DESCRIPTION_DELIVERY dd ON dd.ID_ORDER_DELIVERY = od.ID_ORDER_DELIVERY
       WHERE od.ID_ORDER = ?
       ORDER BY od.FECHA DESC, dd.ID_DESCRIPTION_DELIVERY ASC`,
      [orderId]
    )
    return rows
  }
}
