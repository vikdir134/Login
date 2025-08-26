// src/controllers/deliveries.controller.js
import { z } from 'zod'
import { DeliveriesModel } from '../models/deliveries.model.js'
import { pool } from '../db.js'

const lineSchema = z.object({
  descriptionOrderId: z.number().int().positive(),
  peso: z.number().positive(),
  descripcion: z.string().max(50).optional().nullable(),
  unitPrice: z.number().nonnegative().optional().nullable()
})
const createDeliverySchema = z.object({
  orderId: z.number().int().positive(),
  facturaId: z.number().int().positive().optional().nullable(),
  fecha: z.string().min(8).optional(),   // opcional → si no viene usamos NOW()
  lines: z.array(lineSchema).nonempty()
})

// src/controllers/deliveries.controller.js
export async function createDelivery(req, res) {
  try {
    const { orderId, facturaId, lines } = req.body
    const createdBy = req.user?.id ?? null
    const out = await DeliveriesModel.create({ orderId, facturaId: facturaId ?? null, createdBy, lines })
    res.status(201).json(out)
  } catch (e) {
    // Errores de negocio conocidos
    if (e.code === 'ORDER_NOT_FOUND')     return res.status(404).json({ error: 'Pedido no existe', code: e.code })
    if (e.code === 'ORDER_LINE_INVALID')  return res.status(400).json({ error: 'Línea de pedido inválida', code: e.code })
    if (e.code === 'EXCEEDS_PENDING')     return res.status(400).json({ error: 'Excede lo pendiente', code: e.code })
    if (e.code === 'PT_STOCK_NOT_ENOUGH') return res.status(400).json({ error: e.message || 'No hay suficiente stock en el almacén', code: e.code })

    // Log completo a la terminal SIEMPRE
    console.error('[createDelivery] Unhandled error:', e)

    // En desarrollo devuelve más detalle para depurar
    const isDev = process.env.NODE_ENV !== 'production'
    return res.status(500).json({
      error: 'Error creando entrega',
      code: e.code || 'UNHANDLED',
      ...(isDev ? { message: e.message, sqlMessage: e.sqlMessage, stack: e.stack } : {})
    })
  }
}

export async function listDeliveriesByOrder(req, res) {////////
  try {
    const { orderId } = req.params
    const data = await DeliveriesModel.listByOrder(Number(orderId))
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error listando entregas' })
  }
}
export async function listAllDeliveries(req, res) {
  try {
    const schema = z.object({
      q: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      limit: z.coerce.number().int().positive().max(200).optional(),
      offset: z.coerce.number().int().nonnegative().optional(),
    })
    const parsed = schema.safeParse(req.query)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })

    const data = await DeliveriesModel.listAll(parsed.data)
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error listando entregas' })
  }
}
export async function listDeliveries(req, res) {
  try {
    const schema = z.object({
      q: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      limit: z.coerce.number().int().positive().max(200).optional(),
      offset: z.coerce.number().int().nonnegative().optional()
    })
    const { q, from, to, limit = 30, offset = 0 } = schema.parse(req.query)

    const params = []
    let where = ' WHERE 1=1 '

    if (from) { where += ' AND od.FECHA >= ? '; params.push(from + ' 00:00:00') }
    if (to)   { where += ' AND od.FECHA <= ? '; params.push(to   + ' 23:59:59') }

    // q: cliente o producto
    if (q) {
      where += ` AND (
        c.RAZON_SOCIAL LIKE ? OR
        p.DESCRIPCION  LIKE ?
      ) `
      params.push(`%${q}%`, `%${q}%`)
    }

    // total
    const [[{ total }]] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM ORDER_DELIVERY od
      JOIN ORDERS o        ON o.ID_ORDER = od.ID_ORDER
      JOIN CUSTOMERS c     ON c.ID_CUSTOMER = o.ID_CUSTOMER
      LEFT JOIN DESCRIPTION_DELIVERY dd ON dd.ID_ORDER_DELIVERY = od.ID_ORDER_DELIVERY
      LEFT JOIN DESCRIPTION_ORDER do2    ON do2.ID_DESCRIPTION_ORDER = dd.ID_DESCRIPTION_ORDER
      LEFT JOIN PRODUCTS p               ON p.ID_PRODUCT = do2.ID_PRODUCT
      ${where}
      `,
      params
    )

    // filas agregadas por entrega
    const [rows] = await pool.query(
      `
      SELECT
        od.ID_ORDER_DELIVERY        AS deliveryId,
        od.ID_ORDER                 AS orderId,
        od.FECHA                    AS fecha,
        c.RAZON_SOCIAL              AS customerName,
        SUM(dd.PESO)                AS pesoTotal,
        SUM(IFNULL(dd.SUBTOTAL,0))  AS subtotalTotal,
        MIN(dd.CURRENCY)            AS currency
      FROM ORDER_DELIVERY od
      JOIN ORDERS o        ON o.ID_ORDER = od.ID_ORDER
      JOIN CUSTOMERS c     ON c.ID_CUSTOMER = o.ID_CUSTOMER
      LEFT JOIN DESCRIPTION_DELIVERY dd ON dd.ID_ORDER_DELIVERY = od.ID_ORDER_DELIVERY
      LEFT JOIN DESCRIPTION_ORDER do2    ON do2.ID_DESCRIPTION_ORDER = dd.ID_DESCRIPTION_ORDER
      LEFT JOIN PRODUCTS p               ON p.ID_PRODUCT = do2.ID_PRODUCT
      ${where}
      GROUP BY od.ID_ORDER_DELIVERY, od.ID_ORDER, od.FECHA, c.RAZON_SOCIAL
      ORDER BY od.FECHA DESC, od.ID_ORDER_DELIVERY DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    )

    res.json({ items: rows, total: Number(total || 0) })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error listando entregas' })
  }
}