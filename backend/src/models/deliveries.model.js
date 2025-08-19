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
    `SELECT d.ID_DESCRIPTION_ORDER AS id,
            d.ID_ORDER AS orderId,
            d.ID_PRODUCT AS productId,
            d.PESO AS pesoPedido,
            d.PRESENTACION AS presentacion
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
     WHERE ID_DESCRIPTION_ORDER = ?`,
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
  // Crea cabecera + líneas. Si fecha es null/undefined, se usa NOW() (servidor)
  static async create({ orderId, facturaId = null, fecha = null, createdBy = null, lines }) {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      // 1) Validar pedido
      const head = await findOrderHeaderById(orderId)
      if (!head) throw Object.assign(new Error('Pedido no existe'), { code: 'ORDER_NOT_FOUND' })

      // 2) Cabecera (COALESCE para usar NOW() si no envías fecha)
      const [resHead] = await conn.query(
        `INSERT INTO ORDER_DELIVERY (ID_ORDER, ID_FACTURA, FECHA, CREATED_BY)
         VALUES (?, ?, COALESCE(?, NOW()), ?)`,
        [orderId, facturaId, fecha, createdBy]
      )
      const deliveryId = resHead.insertId

      const createdLines = []
      for (const l of lines) {
        // 3) Validar línea de pedido
        const ol = await findOrderLine(l.descriptionOrderId)
        if (!ol || ol.orderId !== orderId) {
          throw Object.assign(new Error('Línea de pedido inválida'), { code: 'ORDER_LINE_INVALID' })
        }

        // 4) Verificar pendiente
        const entregado = await getDeliveredForLine(conn, l.descriptionOrderId)
        const pedido = Number(ol.pesoPedido || 0)
        const restante = Math.max(0, pedido - entregado)

        if (restante <= 0) {
          throw Object.assign(new Error('La línea ya está completamente entregada'), {
            code: 'ALREADY_FULFILLED'
          })
        }
        if (Number(l.peso) > restante + 1e-9) {
          throw Object.assign(new Error(`Excede lo pendiente. Restante: ${restante} kg`), {
            code: 'OVER_DELIVERY',
            remaining: restante
          })
        }

        // 5) Determinar precio
        let unitPrice = l.unitPrice
        let currency = 'PEN'
        if (unitPrice === undefined || unitPrice === null) {
          const atDate = (fecha ?? new Date()).toISOString().slice(0,10)  // YYYY-MM-DD
          const eff = await getEffectivePrice({
            customerId: head.customerId,
            productId: ol.productId,
            atDate
          })
          if (!eff) {
            throw Object.assign(new Error('No hay precio vigente para el producto de esta línea en la fecha de entrega'),
              { code: 'NO_EFFECTIVE_PRICE' })
          }
          unitPrice = Number(eff.PRICE)
          currency = eff.CURRENCY || 'PEN'
        }

        // 6) Insertar línea
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
        })
      }

      await conn.commit()

// ← actualiza el estado del pedido si corresponde
await markOrderDeliveredIfComplete(orderId)

const [sumRows] = await pool.query(
  `SELECT COUNT(*) AS lineCount, IFNULL(SUM(SUBTOTAL),0) AS monto
   FROM DESCRIPTION_DELIVERY WHERE ID_ORDER_DELIVERY = ?`, [deliveryId]
)

      return {
        id: deliveryId,
        orderId,
        facturaId,
        // si enviaste fecha la devolvemos, si no la leerías luego en un GET (aquí no recargo)
        fecha: fecha ?? null,
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
