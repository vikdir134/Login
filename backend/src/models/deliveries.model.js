import { pool } from '../db.js'
import { markOrderDeliveredIfComplete } from './orders.model.js'

// Aux

async function findOrderHeaderById(orderId) {
  const [rows] = await pool.query(
    `SELECT o.ID_ORDER AS id, o.ID_CUSTOMER AS customerId, o.FECHA AS createdAt
     FROM ORDERS o WHERE o.ID_ORDER = ?`,
    [orderId]
  )
  return rows[0] || null
}
async function findOrderLine(lineId) {
  const [rows] = await pool.query(
    `SELECT d.ID_DESCRIPTION_ORDER AS id, d.ID_ORDER AS orderId, d.ID_PRODUCT AS productId,
            d.PESO AS pesoPedido, d.PRESENTACION AS presentacion
     FROM DESCRIPTION_ORDER d
     WHERE d.ID_DESCRIPTION_ORDER = ?`,
    [lineId]
  )
  return rows[0] || null
}

async function getDeliveredForLine(connOrPool, lineId) {
  const [sum] = await connOrPool.query(
    `SELECT IFNULL(SUM(PESO),0) AS entregado
     FROM DESCRIPTION_DELIVERY
     WHERE ID_DESCRIPTION_ORDER = ?`,//////
    [lineId]
  )
  return Number(sum[0]?.entregado || 0)
}

// Precio vigente por cliente+producto en una fecha (VALID_FROM <= fecha < VALID_TO o VALID_TO IS NULL)
async function getEffectivePrice({ customerId, productId, atDate }) {
  const [rows] = await pool.query(
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
  // orderId, facturaId? , fecha? , createdBy? , lines[ {descriptionOrderId, peso, descripcion?, unitPrice?} ]
  static async create({ orderId, facturaId = null, fecha, createdBy = null, lines }) {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      const head = await findOrderHeaderById(orderId)
      if (!head) throw Object.assign(new Error('Pedido no existe'), { code: 'ORDER_NOT_FOUND' })

      // Si no envías fecha, usamos NOW() directamente en SQL
      const useNow = !fecha
      const [resHead] = await conn.query(
        `INSERT INTO ORDER_DELIVERY (ID_ORDER, ID_FACTURA, FECHA, CREATED_BY)
         VALUES (?, ?, ${useNow ? 'NOW()' : '?'}, ?)`,
        useNow ? [orderId, facturaId, createdBy] : [orderId, facturaId, fecha, createdBy]
      )
      const deliveryId = resHead.insertId

      // Obtener zona PT de despacho
      const [spaceRow] = await conn.query(
        `SELECT ID_SPACE AS id FROM SPACES WHERE NOMBRE='PT_ALMACEN' LIMIT 1`
      )
      const ptSpaceId = spaceRow[0]?.id
      if (!ptSpaceId) {
        throw Object.assign(new Error('Falta configurar zona PT_ALMACEN'), { code: 'PT_SPACE_MISSING' })
      }

      const createdLines = []
      for (const l of lines) {
        const ol = await findOrderLine(l.descriptionOrderId)
        if (!ol || ol.orderId !== orderId) {
          throw Object.assign(new Error('Línea de pedido inválida'), { code: 'ORDER_LINE_INVALID' })
        }

        // Precio unitario a partir de lista de precios si no viene
        let unitPrice = l.unitPrice
        let currency = 'PEN'
        const fechaBase = (fecha || '').split(' ')[0] || (new Date()).toISOString().slice(0,10)
        if (unitPrice === undefined || unitPrice === null) {
          const eff = await getEffectivePrice({
            customerId: head.customerId,
            productId: ol.productId,
            atDate: fechaBase
          })
          if (!eff) {
            throw Object.assign(new Error('No hay precio vigente para el producto en la fecha'), { code: 'NO_EFFECTIVE_PRICE' })
          }
          unitPrice = Number(eff.PRICE)
          currency = eff.CURRENCY || 'PEN'
        }

        // Validar stock PT suficiente en PT_ALMACEN
        const [stkRows] = await conn.query(
          `SELECT IFNULL(SUM(PESO),0) AS qty
             FROM STOCK_FINISHED_PRODUCT
            WHERE ID_PRODUCT = ? AND ID_SPACE = ?`,
          [ol.productId, ptSpaceId]
        )
        const disponible = Number(stkRows[0].qty || 0)
        if (disponible + 1e-9 < Number(l.peso)) {
          throw Object.assign(new Error('Stock de PT insuficiente'), { code: 'INSUFFICIENT_STOCK_PT' })
        }

        // Insertar línea de entrega
        await conn.query(
          `INSERT INTO DESCRIPTION_DELIVERY
            (ID_ORDER_DELIVERY, ID_DESCRIPTION_ORDER, PESO, DESCRIPCION, UNIT_PRICE, CURRENCY)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [deliveryId, l.descriptionOrderId, l.peso, l.descripcion ?? null, unitPrice, currency]
        )

        // Registrar SALIDA de PT (negativo) desde PT_ALMACEN
        await conn.query(
          `INSERT INTO STOCK_FINISHED_PRODUCT (ID_PRODUCT, ID_SPACE, PESO, FECHA)
           VALUES (?, ?, ?, NOW())`,
          [ol.productId, ptSpaceId, -Number(l.peso)]
        )

        createdLines.push({
          descriptionOrderId: l.descriptionOrderId,
          peso: Number(l.peso),
          unitPrice: Number(unitPrice),
          currency
        })
      }

      await conn.commit()

      const [sumRows] = await pool.query(
        `SELECT COUNT(*) AS lineCount, IFNULL(SUM(SUBTOTAL),0) AS monto
           FROM DESCRIPTION_DELIVERY WHERE ID_ORDER_DELIVERY = ?`,
        [deliveryId]
      )

      return {
        id: deliveryId,
        orderId,
        facturaId,
        fecha: fecha || new Date().toISOString().slice(0,19).replace('T',' '),
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