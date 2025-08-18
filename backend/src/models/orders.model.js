import { pool } from '../db.js'

export class OrdersModel {
  // Pedidos de un cliente con agregados
  static async listByCustomer(customerId) {
    const [rows] = await pool.query(
      `
      SELECT
        o.ID_ORDER                                     AS id,
        o.FECHA                                        AS fecha,
        s.DESCRIPCION                                  AS estado,

        IFNULL((
          SELECT SUM(dd.SUBTOTAL)
          FROM ORDER_DELIVERY od
          JOIN DESCRIPTION_DELIVERY dd ON dd.ID_ORDER_DELIVERY = od.ID_ORDER_DELIVERY
          WHERE od.ID_ORDER = o.ID_ORDER
        ), 0) AS total_entregado,

        IFNULL((
          SELECT SUM(p.AMOUNT)
          FROM PAYMENTS p
          WHERE p.ID_ORDER = o.ID_ORDER
        ), 0) AS total_pagado,

        IFNULL((
          SELECT SUM(do2.PESO)
          FROM DESCRIPTION_ORDER do2
          WHERE do2.ID_ORDER = o.ID_ORDER
        ), 0) AS peso_pedido,

        IFNULL((
          SELECT SUM(dd2.PESO)
          FROM ORDER_DELIVERY od2
          JOIN DESCRIPTION_DELIVERY dd2 ON dd2.ID_ORDER_DELIVERY = od2.ID_ORDER_DELIVERY
          WHERE od2.ID_ORDER = o.ID_ORDER
        ), 0) AS peso_entregado
      FROM ORDERS o
      JOIN STATES s ON s.ID_STATE = o.ID_STATE
      WHERE o.ID_CUSTOMER = ?
      ORDER BY o.FECHA DESC
      `,
      [customerId]
    )

    return rows.map(r => {
      const progreso = r.peso_pedido > 0 ? (r.peso_entregado / r.peso_pedido) * 100 : 0
      return {
        id: r.id,
        fecha: r.fecha,
        estado: r.estado,
        total_entregado: Number(r.total_entregado),
        total_pagado: Number(r.total_pagado),
        pagado_en_su_totalidad: Number(r.total_pagado) >= Number(r.total_entregado),
        peso_pedido: Number(r.peso_pedido),
        peso_entregado: Number(r.peso_entregado),
        progreso_entrega_pct: Number(progreso.toFixed(2))
      }
    })
  }

  // Cabecera + totales del pedido
  static async getOverview(orderId) {
    // Cabecera
    const [headRows] = await pool.query(
      `
      SELECT
        o.ID_ORDER AS id, o.FECHA, o.ID_CUSTOMER, c.RAZON_SOCIAL AS cliente,
        s.DESCRIPCION AS estado
      FROM ORDERS o
      JOIN CUSTOMERS c ON c.ID_CUSTOMER = o.ID_CUSTOMER
      JOIN STATES s    ON s.ID_STATE = o.ID_STATE
      WHERE o.ID_ORDER = ?
      `,
      [orderId]
    )
    if (!headRows[0]) return null
    const header = headRows[0]

    // Totales
    const [totals] = await pool.query(
      `
      SELECT
        IFNULL((
          SELECT SUM(dd.SUBTOTAL)
          FROM ORDER_DELIVERY od
          JOIN DESCRIPTION_DELIVERY dd ON dd.ID_ORDER_DELIVERY = od.ID_ORDER_DELIVERY
          WHERE od.ID_ORDER = ?
        ), 0) AS total_entregado,

        IFNULL((
          SELECT SUM(p.AMOUNT)
          FROM PAYMENTS p
          WHERE p.ID_ORDER = ?
        ), 0) AS total_pagado,

        IFNULL((
          SELECT SUM(do2.PESO)
          FROM DESCRIPTION_ORDER do2
          WHERE do2.ID_ORDER = ?
        ), 0) AS peso_pedido,

        IFNULL((
          SELECT SUM(dd2.PESO)
          FROM ORDER_DELIVERY od2
          JOIN DESCRIPTION_DELIVERY dd2 ON dd2.ID_ORDER_DELIVERY = od2.ID_ORDER_DELIVERY
          WHERE od2.ID_ORDER = ?
        ), 0) AS peso_entregado
      `,
      [orderId, orderId, orderId, orderId]
    )
    const t = totals[0]
    const progreso = t.peso_pedido > 0 ? (t.peso_entregado / t.peso_pedido) * 100 : 0

    return {
      header: {
        id: header.id,
        fecha: header.FECHA,
        cliente: header.cliente,
        estado: header.estado
      },
      totals: {
        total_entregado: Number(t.total_entregado),
        total_pagado: Number(t.total_pagado),
        pagado_en_su_totalidad: Number(t.total_pagado) >= Number(t.total_entregado),
        peso_pedido: Number(t.peso_pedido),
        peso_entregado: Number(t.peso_entregado),
        progreso_entrega_pct: Number(progreso.toFixed(2))
      }
    }
  }

  static async listPayments(orderId) {
    const [rows] = await pool.query(
      `
      SELECT
        ID_PAYMENT   AS id,
        PAYMENT_DATE AS fecha,
        AMOUNT       AS monto,
        METHOD       AS metodo,
        REFERENCE    AS referencia,
        OBSERVACION  AS observacion,
        CURRENCY     AS moneda
      FROM PAYMENTS
      WHERE ID_ORDER = ?
      ORDER BY PAYMENT_DATE DESC, ID_PAYMENT DESC
      `,
      [orderId]
    )
    return rows
  }

  static async listDeliveries(orderId) {
    const [rows] = await pool.query(
      `
      SELECT
        od.ID_ORDER_DELIVERY  AS delivery_id,
        od.FECHA              AS fecha,
        od.ID_FACTURA,
        dd.ID_DESCRIPTION_DELIVERY AS linea_id,
        dd.PESO               AS peso,
        dd.UNIT_PRICE         AS unit_price,
        dd.SUBTOTAL           AS subtotal,
        dd.CURRENCY           AS moneda,
        pr.DESCRIPCION        AS producto
      FROM ORDER_DELIVERY od
      JOIN DESCRIPTION_DELIVERY dd ON dd.ID_ORDER_DELIVERY = od.ID_ORDER_DELIVERY
      JOIN DESCRIPTION_ORDER dord  ON dord.ID_DESCRIPTION_ORDER = dd.ID_DESCRIPTION_ORDER
      JOIN PRODUCTS pr             ON pr.ID_PRODUCT = dord.ID_PRODUCT
      WHERE od.ID_ORDER = ?
      ORDER BY od.FECHA DESC, dd.ID_DESCRIPTION_DELIVERY ASC
      `,
      [orderId]
    )
    return rows
  }
}
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
    // buscar ID_STATE = 'ENTREGADO'
    const [[st]] = await pool.query(`SELECT ID_STATE FROM STATES WHERE DESCRIPCION='ENTREGADO' LIMIT 1`)
    if (st?.ID_STATE) {
      await pool.query(`UPDATE ORDERS SET ID_STATE=? WHERE ID_ORDER=?`, [st.ID_STATE, orderId])
      return true
    }
  }
  return false
}