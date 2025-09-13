// backend/src/models/deliveries.model.js
import { pool } from '../db.js'
import { findOrderHeaderById, findOrderLine } from './_deliveries.helpers.js'
import { getEffectivePrice, upsertCustomerProductPrice } from './prices.model.js'

// === helpers ===
async function getPtZoneId(conn) {
  const [z] = await conn.query(`SELECT ID_SPACE id FROM SPACES WHERE NOMBRE = 'PT_ALMACEN' LIMIT 1`)
  return z[0]?.id || null
}

/**
 * Descuenta PT en FIFO, restringiendo por presentación (texto).
 * - presentacion = null → descuenta SOLO filas con PRESENTACION IS NULL.
 * - si tiene valor → descuenta SOLO esa presentación.
 */
async function deductFinishedFIFO(conn, { productId, presentacion, peso }) {
  const zoneId = await getPtZoneId(conn)
  if (!zoneId) throw new Error('No existe zona PT_ALMACEN')

  const [lots] = await conn.query(
    `SELECT ID_PRO id, PESO, FECHA
       FROM STOCK_FINISHED_PRODUCT
      WHERE ID_PRODUCT = ?
        AND ID_SPACE   = ?
        AND (PRESENTACION <=> ?)
      ORDER BY FECHA ASC, ID_PRO ASC`,
    [productId, zoneId, presentacion ?? null]
  )

  const disponible = lots.reduce((a, l) => a + Number(l.PESO || 0), 0)
  const need = Number(peso || 0)

  if (disponible + 1e-9 < need) {
    const etiqueta = presentacion ?? '—'
    const err = new Error(`No hay suficiente stock en almacén (presentación ${etiqueta}). Disponible: ${disponible}`)
    err.code = 'PT_STOCK_NOT_ENOUGH'
    throw err
  }

  let remaining = need
  for (const l of lots) {
    if (remaining <= 1e-9) break
    const take = Math.min(remaining, Number(l.PESO))
    await conn.query(
      `INSERT INTO STOCK_FINISHED_PRODUCT (ID_PRODUCT, ID_SPACE, PRESENTACION, PESO, FECHA)
       VALUES (?, ?, ?, ?, NOW())`,
      [productId, zoneId, presentacion ?? null, -take]
    )
    remaining -= take
  }
}

export class DeliveriesModel {
  static async create({ orderId, facturaId = null, guiaId = null, createdBy = null, lines }) {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      const head = await findOrderHeaderById(orderId, conn)
      if (!head) { const e = new Error('Pedido no existe'); e.code = 'ORDER_NOT_FOUND'; throw e }

      // === Cabecera de entrega ===
      let deliveryId = null
      try {
        // Intento con ID_GUIA (si la columna existe)
        const [resHead] = await conn.query(
          `INSERT INTO ORDER_DELIVERY (ID_ORDER, ID_FACTURA, ID_GUIA, FECHA, CREATED_BY)
           VALUES (?, ?, ?, NOW(), ?)`,
          [orderId, facturaId ?? null, guiaId ?? null, createdBy]
        )
        deliveryId = resHead.insertId
      } catch (err) {
        // Si aún no existe la columna ID_GUIA, caemos a versión anterior
        if (err?.code === 'ER_BAD_FIELD_ERROR' || /ID_GUIA/i.test(err?.message || '')) {
          const [resHead2] = await conn.query(
            `INSERT INTO ORDER_DELIVERY (ID_ORDER, ID_FACTURA, FECHA, CREATED_BY)
             VALUES (?, ?, NOW(), ?)`,
            [orderId, facturaId ?? null, createdBy]
          )
          deliveryId = resHead2.insertId
        } else {
          throw err
        }
      }

      const createdLines = []
      const atDate = new Date().toISOString().slice(0,10) // YYYY-MM-DD

      for (const l of lines) {
        // 1) Validar línea de pedido
        const ol = await findOrderLine(l.descriptionOrderId, conn)
        if (!ol || ol.orderId !== orderId) {
          const e = new Error('Línea de pedido inválida'); e.code = 'ORDER_LINE_INVALID'; throw e
        }

        // 2) Precio
        let unitPrice = (l.unitPrice !== undefined && l.unitPrice !== null) ? Number(l.unitPrice) : undefined
        let currency  = l.currency || 'PEN'

        if (unitPrice === undefined) {
          const eff = await getEffectivePrice({ customerId: head.customerId, productId: ol.productId, atDate }, conn)
          unitPrice = eff ? Number(eff.PRICE) : 0
          currency  = eff ? (eff.CURRENCY || 'PEN') : 'PEN'
        } else {
          await upsertCustomerProductPrice({
            customerId: head.customerId,
            productId:  ol.productId,
            price:      unitPrice,
            currency,
            atDate
          }, conn)
        }

        // 3) No exceder pendiente
        const [[pend]] = await conn.query(
          `SELECT d.PESO AS pedido, IFNULL(SUM(x.PESO),0) AS entregado
             FROM DESCRIPTION_ORDER d
             LEFT JOIN DESCRIPTION_DELIVERY x
               ON x.ID_DESCRIPTION_ORDER = d.ID_DESCRIPTION_ORDER
            WHERE d.ID_DESCRIPTION_ORDER = ?`,
          [l.descriptionOrderId]
        )
        const pendiente = Number(pend.pedido) - Number(pend.entregado)
        if (Number(l.peso) > pendiente + 1e-9) {
          const e = new Error('Excede lo pendiente'); e.code = 'EXCEEDS_PENDING'; throw e
        }

        // 4) Descontar stock por presentación
        // ... (tu deductFinishedFIFO como ya lo tenías)

        // 5) Insertar línea
        await conn.query(
          `INSERT INTO DESCRIPTION_DELIVERY
            (ID_ORDER_DELIVERY, ID_DESCRIPTION_ORDER, PESO, DESCRIPCION, UNIT_PRICE, CURRENCY)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [deliveryId, l.descriptionOrderId, Number(l.peso), l.descripcion ?? null, Number(unitPrice), currency]
        )

        createdLines.push({
          descriptionOrderId: l.descriptionOrderId,
          peso: Number(l.peso),
          unitPrice: Number(unitPrice),
          currency
        })
      }

      await conn.commit()
      return { id: deliveryId, orderId, facturaId, guiaId: guiaId ?? null, lineCount: createdLines.length, lines: createdLines }
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }

  // backend/src/models/deliveries.model.js  (solo listByOrder)
// backend/src/models/deliveries.model.js
static async listByOrder(orderId) {
  const [rows] = await pool.query(
    `
    SELECT
      od.ID_ORDER_DELIVERY          AS deliveryId,
      od.FECHA                      AS fecha,
      od.ID_FACTURA                 AS facturaId,
      f.CODIGO                      AS invoiceCode,
      f.ARCHIVO_PATH                AS invoicePath,   -- <-- usa ARCHIVO_URL si ese es tu campo
      od.ID_GUIA                    AS guiaId,
      g.CODIGO                      AS guiaCode,
      g.ARCHIVO_PATH                AS guiaPath,      -- <-- idem arriba
      dd.ID_DESCRIPTION_DELIVERY    AS lineId,
      dd.ID_DESCRIPTION_ORDER       AS descriptionOrderId,
      dd.PESO                       AS peso,
      dd.UNIT_PRICE                 AS unitPrice,
      dd.SUBTOTAL                   AS subtotal,
      dd.CURRENCY                   AS currency
    FROM ORDER_DELIVERY od
    JOIN DESCRIPTION_DELIVERY dd ON dd.ID_ORDER_DELIVERY = od.ID_ORDER_DELIVERY
    LEFT JOIN FACTURAS f ON f.ID_FACTURA = od.ID_FACTURA
    LEFT JOIN GUIAS g    ON g.ID_GUIA    = od.ID_GUIA
    WHERE od.ID_ORDER = ?
    ORDER BY od.FECHA DESC, dd.ID_DESCRIPTION_DELIVERY ASC
    `,
    [orderId]
  )
  return rows
}






  static async listAll({ q, from, to, limit = 30, offset = 0 }) {
    const params = []
    let where = ' WHERE 1=1 '
    if (from) { where += ' AND od.FECHA >= ? '; params.push(from + ' 00:00:00') }
    if (to)   { where += ' AND od.FECHA <= ? '; params.push(to   + ' 23:59:59') }
    if (q) {
      where += ' AND (c.RAZON_SOCIAL LIKE ? OR p.DESCRIPCION LIKE ? OR s.DESCRIPCION LIKE ?)'
      params.push(`%${q}%`, `%${q}%`, `%${q}%`)
    }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) total
         FROM ORDER_DELIVERY od
         JOIN ORDERS o   ON o.ID_ORDER = od.ID_ORDER
         JOIN STATES s   ON s.ID_STATE = o.ID_STATE
         JOIN CUSTOMERS c ON c.ID_CUSTOMER = o.ID_CUSTOMER
        ${where}`,
      params
    )

    const [rows] = await pool.query(
      `SELECT
         od.ID_ORDER_DELIVERY              AS deliveryId,
         od.ID_ORDER                       AS orderId,
         od.FECHA                          AS fecha,
         c.RAZON_SOCIAL                    AS customerName,
         s.DESCRIPCION                     AS orderState,
         IFNULL(SUM(dd.PESO),0)            AS pesoTotal,
         IFNULL(SUM(dd.SUBTOTAL),0)        AS subtotalTotal,
         MIN(NULLIF(dd.CURRENCY, ''))      AS currency
       FROM ORDER_DELIVERY od
       JOIN ORDERS o   ON o.ID_ORDER = od.ID_ORDER
       JOIN STATES s   ON s.ID_STATE = o.ID_STATE
       JOIN CUSTOMERS c ON c.ID_CUSTOMER = o.ID_CUSTOMER
       LEFT JOIN DESCRIPTION_DELIVERY dd ON dd.ID_ORDER_DELIVERY = od.ID_ORDER_DELIVERY
       ${where}
       GROUP BY od.ID_ORDER_DELIVERY, od.ID_ORDER, od.FECHA, c.RAZON_SOCIAL, s.DESCRIPCION
       ORDER BY od.FECHA DESC, od.ID_ORDER_DELIVERY DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    )

    return { items: rows, total: Number(total || 0) }
  }
}
