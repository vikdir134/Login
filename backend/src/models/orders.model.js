import { pool } from '../db.js'

export class OrdersModel {
  static async list({ customerId = null, state = null, from = null, to = null, limit = 50, offset = 0 }) {
    const params = []
    let where = 'WHERE 1=1'
    if (customerId) { where += ' AND o.ID_CUSTOMER = ?'; params.push(customerId) }
    if (state)      { where += ' AND s.DESCRIPCION = ?'; params.push(state) }
    if (from)       { where += ' AND o.FECHA >= ?'; params.push(from) }
    if (to)         { where += ' AND o.FECHA < DATE_ADD(?, INTERVAL 1 DAY)'; params.push(to) }

    const [rows] = await pool.query(
      `SELECT o.ID_ORDER AS id, o.ID_CUSTOMER AS customerId, c.RAZON_SOCIAL AS customerName,
              o.FECHA AS fecha, s.DESCRIPCION AS estado
       FROM ORDERS o
       JOIN CUSTOMERS c ON c.ID_CUSTOMER = o.ID_CUSTOMER
       JOIN STATES s    ON s.ID_STATE = o.ID_STATE
       ${where}
       ORDER BY o.FECHA DESC, o.ID_ORDER DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    )
    return rows
  }

  static async getOne(orderId) {
    const [[head]] = await pool.query(
      `SELECT o.ID_ORDER AS id, o.ID_CUSTOMER AS customerId, c.RAZON_SOCIAL AS customerName,
              o.FECHA AS fecha, s.DESCRIPCION AS estado
       FROM ORDERS o
       JOIN CUSTOMERS c ON c.ID_CUSTOMER = o.ID_CUSTOMER
       JOIN STATES s    ON s.ID_STATE = o.ID_STATE
       WHERE o.ID_ORDER = ?`,
      [orderId]
    )
    if (!head) return null

    const [lines] = await pool.query(
      `SELECT d.ID_DESCRIPTION_ORDER AS id, d.ID_PRODUCT AS productId,
              p.DESCRIPCION AS productName, d.PESO AS peso, d.PRESENTACION AS presentacion
       FROM DESCRIPTION_ORDER d
       JOIN PRODUCTS p ON p.ID_PRODUCT = d.ID_PRODUCT
       WHERE d.ID_ORDER = ?
       ORDER BY d.ID_DESCRIPTION_ORDER ASC`,
      [orderId]
    )

    const [[sumEnt]] = await pool.query(
      `SELECT IFNULL(SUM(dd.PESO),0) AS entregadoPeso, IFNULL(SUM(dd.SUBTOTAL),0) AS entregadoValor
       FROM ORDER_DELIVERY od
       JOIN DESCRIPTION_DELIVERY dd ON dd.ID_ORDER_DELIVERY = od.ID_ORDER_DELIVERY
       WHERE od.ID_ORDER = ?`,
      [orderId]
    )

    const [[sumPag]] = await pool.query(
      `SELECT IFNULL(SUM(p.AMOUNT),0) AS totalPagado
       FROM PAYMENTS p
       WHERE p.ID_ORDER = ?`,
      [orderId]
    )

    const pedidoPeso = lines.reduce((acc, l) => acc + Number(l.peso || 0), 0)
    const entregadoPeso = Number(sumEnt.entregadoPeso || 0)
    const pagado = Number(sumPag.totalPagado || 0)

    return {
      ...head,
      lines,
      pedidoPeso,
      entregadoPeso,
      avanceEntrega: pedidoPeso > 0 ? Math.min(100, Math.round((entregadoPeso / pedidoPeso) * 100)) : 0,
      totalPagado: pagado
    }
  }

  static async create({ customerId, fecha, stateName = 'PENDIENTE', createdBy = null, lines }) {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      const [[st]] = await conn.query(`SELECT ID_STATE FROM STATES WHERE DESCRIPCION=? LIMIT 1`, [stateName])
      if (!st) {
        const e = new Error('Estado inválido')
        e.code = 'STATE_NOT_FOUND'
        throw e
      }

      const [resHead] = await conn.query(
        `INSERT INTO ORDERS (ID_CUSTOMER, ID_STATE, FECHA, CREATED_BY) VALUES (?, ?, ?, ?)`,
        [customerId, st.ID_STATE, fecha, createdBy]
      )
      const orderId = resHead.insertId

      for (const it of lines) {
        await conn.query(
          `INSERT INTO DESCRIPTION_ORDER (ID_PRODUCT, ID_ORDER, PESO, PRESENTACION)
           VALUES (?, ?, ?, ?)`,
          [it.productId, orderId, it.peso, it.presentacion]
        )
      }

      await conn.commit()
      return await this.getOne(orderId)
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }
}

// utilidades usadas por entregas (si aún no las tenías)
export async function getOrderWeights(orderId) {
  const [[row]] = await pool.query(`
    SELECT
      IFNULL((SELECT SUM(PESO) FROM DESCRIPTION_ORDER WHERE ID_ORDER = ?), 0) AS peso_pedido,
      IFNULL((
        SELECT SUM(dd.PESO) FROM ORDER_DELIVERY od
        JOIN DESCRIPTION_DELIVERY dd ON dd.ID_ORDER_DELIVERY = od.ID_ORDER_DELIVERY
        WHERE od.ID_ORDER = ?
      ), 0) AS peso_entregado
  `, [orderId, orderId])
  return { peso_pedido: Number(row.peso_pedido), peso_entregado: Number(row.peso_entregado) }
}

export async function markOrderDeliveredIfComplete(orderId) {
  const { peso_pedido, peso_entregado } = await getOrderWeights(orderId)
  if (peso_pedido > 0 && peso_entregado >= peso_pedido) {
    const [[st]] = await pool.query(`SELECT ID_STATE FROM STATES WHERE DESCRIPCION='ENTREGADO' LIMIT 1`)
    if (st?.ID_STATE) {
      await pool.query(`UPDATE ORDERS SET ID_STATE=? WHERE ID_ORDER=?`, [st.ID_STATE, orderId])
      return true
    }
  }
  return false
}
