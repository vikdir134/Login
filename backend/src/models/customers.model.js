import { pool } from '../db.js'

export class CustomersModel {
  static async list({ q = '', active = null, limit = 50, offset = 0 }) {
    const like = `%${q}%`
    const params = []
    let where = 'WHERE 1=1'
    if (q) { where += ' AND (c.RAZON_SOCIAL LIKE ? OR c.RUC LIKE ?)'; params.push(like, like) }
    if (active !== null) { where += ' AND c.ACTIVO = ?'; params.push(active ? 1 : 0) }

    const [rows] = await pool.query(
      `SELECT c.ID_CUSTOMER AS id, c.RUC, c.RAZON_SOCIAL AS razonSocial, c.ACTIVO AS activo, c.CREATED_AT
       FROM CUSTOMERS c
       ${where}
       ORDER BY c.RAZON_SOCIAL ASC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    )
    return rows
  }

  static async create({ ruc, razonSocial, activo = 1 }) {
    const [res] = await pool.query(
      `INSERT INTO CUSTOMERS (RUC, RAZON_SOCIAL, ACTIVO) VALUES (?, ?, ?)`,
      [ruc, razonSocial, activo ? 1 : 0]
    )
    return { id: res.insertId, ruc, razonSocial, activo: !!activo }
  }

  // Resumen útil para la ficha de cliente
  static async getSummary(customerId) {
    const [[cust]] = await pool.query(
      `SELECT ID_CUSTOMER AS id, RUC, RAZON_SOCIAL AS razonSocial, ACTIVO AS activo, CREATED_AT
       FROM CUSTOMERS WHERE ID_CUSTOMER = ?`, [customerId]
    )
    if (!cust) return null

    const [[orders]] = await pool.query(
      `SELECT
          COUNT(*) AS totalPedidos,
          SUM(CASE WHEN s.DESCRIPCION IN ('PENDIENTE','EN_PROCESO') THEN 1 ELSE 0 END) AS pedidosAbiertos
        FROM ORDERS o
        JOIN STATES s ON s.ID_STATE = o.ID_STATE
        WHERE o.ID_CUSTOMER = ?`, [customerId]
    )

    const [[pagos]] = await pool.query(
      `SELECT IFNULL(SUM(p.AMOUNT),0) AS totalPagado
       FROM PAYMENTS p
       JOIN ORDERS o ON o.ID_ORDER = p.ID_ORDER
       WHERE o.ID_CUSTOMER = ?`, [customerId]
    )

    const [[entregas]] = await pool.query(
      `SELECT IFNULL(SUM(dd.SUBTOTAL),0) AS totalEntregadoValor,
              IFNULL(SUM(dd.PESO),0)     AS totalEntregadoPeso
       FROM ORDER_DELIVERY od
       JOIN ORDERS o ON o.ID_ORDER = od.ID_ORDER
       JOIN DESCRIPTION_DELIVERY dd ON dd.ID_ORDER_DELIVERY = od.ID_ORDER_DELIVERY
       WHERE o.ID_CUSTOMER = ?`, [customerId]
    )

    return {
      ...cust,
      totalPedidos: Number(orders.totalPedidos || 0),
      pedidosAbiertos: Number(orders.pedidosAbiertos || 0),
      totalPagado: Number(pagos.totalPagado || 0),
      totalEntregadoValor: Number(entregas.totalEntregadoValor || 0),
      totalEntregadoPeso: Number(entregas.totalEntregadoPeso || 0)
    }
  }
}
