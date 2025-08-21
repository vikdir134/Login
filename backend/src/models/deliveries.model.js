// src/models/deliveries.model.js (añade/ajusta esta parte)
import { pool } from '../db.js'
import { findOrderHeaderById, findOrderLine, getEffectivePrice } from './_deliveries.helpers.js'

// helper: id de zona PT por nombre
async function getPtZoneId(conn) {
  const [z] = await conn.query(`SELECT ID_SPACE id FROM SPACES WHERE NOMBRE = 'PT_ALMACEN' LIMIT 1`)
  return z[0]?.id || null
}

// FIFO: descuenta 'peso' del stock de un producto en zona PT_ALMACEN
async function deductFinishedFIFO(conn, { productId, peso }) {
  const zoneId = await getPtZoneId(conn)
  if (!zoneId) throw new Error('No existe zona PT_ALMACEN')

  // Trae “lotes” (filas de stock) por fecha ascendente
  const [lots] = await conn.query(
    `SELECT ID_PRO id, PESO, FECHA
     FROM STOCK_FINISHED_PRODUCT
     WHERE ID_PRODUCT = ? AND ID_SPACE = ?
     ORDER BY FECHA ASC, ID_PRO ASC`,
    [productId, zoneId]
  )

  let remaining = Number(peso)
  for (const lot of lots) {
    if (remaining <= 1e-9) break
    const take = Math.min(remaining, Number(lot.PESO))
    // registra salida como un “consumo” (insertas negativa) o borras y reinsertas saldo.
    // Para mantener trazabilidad simple: inserto una fila negativa con misma zona.
    await conn.query(
      `INSERT INTO STOCK_FINISHED_PRODUCT (ID_PRODUCT, ID_SPACE, PESO, FECHA)
       VALUES (?, ?, ?, NOW())`,
      [productId, zoneId, -take]
    )
    remaining -= take
  }
  if (remaining > 1e-9) throw new Error('Stock de producto terminado insuficiente')
}

export class DeliveriesModel {
  static async create({ orderId, facturaId = null, createdBy = null, lines }) {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      const head = await findOrderHeaderById(orderId, conn)
      if (!head) throw Object.assign(new Error('Pedido no existe'), { code: 'ORDER_NOT_FOUND' })

      const [resHead] = await conn.query(
        `INSERT INTO ORDER_DELIVERY (ID_ORDER, ID_FACTURA, FECHA, CREATED_BY)
         VALUES (?, ?, NOW(), ?)`,
        [orderId, facturaId, createdBy]
      )
      const deliveryId = resHead.insertId

      const createdLines = []
      for (const l of lines) {
        const ol = await findOrderLine(l.descriptionOrderId, conn)
        if (!ol || ol.orderId !== orderId) {
          throw Object.assign(new Error('Línea de pedido inválida'), { code: 'ORDER_LINE_INVALID' })
        }

        // precio unitario → lista vigente si no viene
        let unitPrice = l.unitPrice
        let currency = 'PEN'
        if (unitPrice === undefined || unitPrice === null) {
          const eff = await getEffectivePrice({
            conn,
            customerId: head.customerId,
            productId: ol.productId,
            atDate: new Date().toISOString().slice(0,10)
          })
          if (!eff) throw Object.assign(new Error('No hay precio vigente'), { code: 'NO_EFFECTIVE_PRICE' })
          unitPrice = Number(eff.PRICE); currency = eff.CURRENCY || 'PEN'
        }

        // validar no exceder pendiente
        const [[pend]] = await conn.query(
          `SELECT
              d.PESO AS pedido,
              IFNULL(SUM(x.PESO),0) AS entregado
           FROM DESCRIPTION_ORDER d
           LEFT JOIN DESCRIPTION_DELIVERY x
             ON x.ID_DESCRIPTION_ORDER = d.ID_DESCRIPTION_ORDER
           WHERE d.ID_DESCRIPTION_ORDER = ?`,
          [l.descriptionOrderId]
        )
        const pendiente = Number(pend.pedido) - Number(pend.entregado)
        if (Number(l.peso) > pendiente + 1e-9) {
          throw Object.assign(new Error('Excede lo pendiente'), { code: 'EXCEEDS_PENDING' })
        }

        // inserta línea de entrega
        await conn.query(
          `INSERT INTO DESCRIPTION_DELIVERY
            (ID_ORDER_DELIVERY, ID_DESCRIPTION_ORDER, PESO, DESCRIPCION, UNIT_PRICE, CURRENCY)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [deliveryId, l.descriptionOrderId, l.peso, l.descripcion ?? null, unitPrice, currency]
        )

        // **descontar PT (FIFO)**
        await deductFinishedFIFO(conn, { productId: ol.productId, peso: Number(l.peso) })

        createdLines.push({
          descriptionOrderId: l.descriptionOrderId,
          peso: Number(l.peso),
          unitPrice: Number(unitPrice),
          currency
        })
      }

      await conn.commit()

      return { id: deliveryId, orderId, facturaId, lineCount: createdLines.length, lines: createdLines }
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
