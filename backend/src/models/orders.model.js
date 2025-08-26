// src/models/orders.model.js
import { pool } from '../db.js'

async function getStateIdByName(name) {
  const [rows] = await pool.query('SELECT ID_STATE AS id FROM STATES WHERE DESCRIPCION = ? LIMIT 1', [name])
  return rows[0]?.id || null
}

export async function createOrderWithLines({ customerId, createdBy = null, lines }) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // estado inicial: PENDIENTE
    const stateId = await getStateIdByName('PENDIENTE')
    if (!stateId) throw Object.assign(new Error('STATE_NOT_FOUND'), { code: 'STATE_NOT_FOUND' })

    const [resOrder] = await conn.query(
      `INSERT INTO ORDERS (ID_CUSTOMER, ID_STATE, CREATED_BY, FECHA)
       VALUES (?, ?, ?, NOW())`,
      [customerId, stateId, createdBy]
    )
    const orderId = resOrder.insertId

    // insertar líneas
    for (const l of lines) {
      await conn.query(
        `INSERT INTO DESCRIPTION_ORDER (ID_PRODUCT, ID_ORDER, PESO, PRESENTACION)
         VALUES (?, ?, ?, ?)`,
        [l.productId, orderId, l.peso, l.presentacion]
      )
    }

    await conn.commit()
    return orderId
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
}
export async function setOrderStateByName(orderId, name) {
  const stateId = await getStateIdByName(name)
  if (!stateId) throw Object.assign(new Error('STATE_NOT_FOUND'), { code:'STATE_NOT_FOUND' })
  const [r] = await pool.query('UPDATE ORDERS SET ID_STATE=? WHERE ID_ORDER=?', [stateId, orderId])
  return r.affectedRows > 0
}
export async function getOrderTotals(orderId) {
  // pedido
  const [[op]] = await pool.query(
    `SELECT IFNULL(SUM(PESO),0) pedido
     FROM DESCRIPTION_ORDER WHERE ID_ORDER=?`, [orderId]
  )
  // entregado
  const [[dl]] = await pool.query(
    `SELECT IFNULL(SUM(dd.PESO),0) entregado
     FROM ORDER_DELIVERY od
     JOIN DESCRIPTION_DELIVERY dd ON dd.ID_ORDER_DELIVERY = od.ID_ORDER_DELIVERY
     WHERE od.ID_ORDER=?`, [orderId]
  )
  return { pedido: Number(op?.pedido || 0), entregado: Number(dl?.entregado || 0) }
}
export async function recomputeAndSetOrderState(orderId) {
  // verificar que exista
  const [[o]] = await pool.query('SELECT ID_ORDER FROM ORDERS WHERE ID_ORDER=? LIMIT 1', [orderId])
  if (!o) return false

  const { pedido, entregado } = await getOrderTotals(orderId)
  let target = 'PENDIENTE'
  if (pedido > 0 && Math.abs(entregado - pedido) < 1e-9) target = 'ENTREGADO'
  else if (entregado > 0 && entregado < pedido) target = 'EN_PROCESO'
  else if (pedido === 0 && entregado === 0) target = 'PENDIENTE'

  await setOrderStateByName(orderId, target)
  return true
}
export async function addOrderLine(orderId, { productId, peso, presentacion }) {
  // existe pedido?
  const [[o]] = await pool.query('SELECT ID_ORDER FROM ORDERS WHERE ID_ORDER=? LIMIT 1', [orderId])
  if (!o) { const err = new Error('ORDER_NOT_FOUND'); err.code='ORDER_NOT_FOUND'; throw err }

  const [r] = await pool.query(
    `INSERT INTO DESCRIPTION_ORDER (ID_PRODUCT, ID_ORDER, PESO, PRESENTACION, OBSERVACION)
     VALUES (?, ?, ?, ?, NULL)`,
    [productId, orderId, peso, presentacion]
  )
  return r.insertId
}
export async function updateOrderLine(orderId, lineId, patch) {
  const [[l]] = await pool.query(
    `SELECT ID_DESCRIPTION_ORDER FROM DESCRIPTION_ORDER WHERE ID_DESCRIPTION_ORDER=? AND ID_ORDER=? LIMIT 1`,
    [lineId, orderId]
  )
  if (!l) { const err=new Error('LINE_NOT_FOUND'); err.code='LINE_NOT_FOUND'; throw err }

  const fields = []
  const vals = []
  if (patch.peso != null) { fields.push('PESO=?'); vals.push(Number(patch.peso)) }
  if (patch.presentacion != null) { fields.push('PRESENTACION=?'); vals.push(Number(patch.presentacion)) }
  if (!fields.length) return

  vals.push(lineId)
  await pool.query(`UPDATE DESCRIPTION_ORDER SET ${fields.join(', ')} WHERE ID_DESCRIPTION_ORDER=?`, vals)
}

export async function deleteOrderLine(orderId, lineId) {
  const [[l]] = await pool.query(
    `SELECT ID_DESCRIPTION_ORDER FROM DESCRIPTION_ORDER WHERE ID_DESCRIPTION_ORDER=? AND ID_ORDER=? LIMIT 1`,
    [lineId, orderId]
  )
  if (!l) { const err=new Error('LINE_NOT_FOUND'); err.code='LINE_NOT_FOUND'; throw err }

  await pool.query(`DELETE FROM DESCRIPTION_ORDER WHERE ID_DESCRIPTION_ORDER=?`, [lineId])
}
// entregado por línea
export async function getDeliveredForLine(lineId) {
  const [[r]] = await pool.query(
    `SELECT IFNULL(SUM(dd.PESO),0) delivered
     FROM DESCRIPTION_DELIVERY dd
     WHERE dd.ID_DESCRIPTION_ORDER=?`, [lineId]
  )
  return Number(r?.delivered || 0)
}
export async function getOrderById(orderId) {
  // cabecera
  const [headRows] = await pool.query(
    `SELECT o.ID_ORDER   AS id,
            o.FECHA      AS fecha,
            o.ID_CUSTOMER AS customerId,
            c.RAZON_SOCIAL AS customerName,
            s.DESCRIPCION  AS state
     FROM ORDERS o
     JOIN CUSTOMERS c ON c.ID_CUSTOMER = o.ID_CUSTOMER
     JOIN STATES s    ON s.ID_STATE = o.ID_STATE
     WHERE o.ID_ORDER = ?`,
    [orderId]
  )
  if (!headRows.length) return null

  // líneas
  const [lineRows] = await pool.query(
    `SELECT d.ID_DESCRIPTION_ORDER AS id,
            d.ID_PRODUCT AS productId,
            p.DESCRIPCION AS productName,
            d.PESO AS peso,
            d.PRESENTACION AS presentacion
     FROM DESCRIPTION_ORDER d
     JOIN PRODUCTS p ON p.ID_PRODUCT = d.ID_PRODUCT
     WHERE d.ID_ORDER = ?
     ORDER BY d.ID_DESCRIPTION_ORDER`,
    [orderId]
  )

  // totales de pedido y entregado
  const [sumPedido] = await pool.query(
    `SELECT IFNULL(SUM(PESO),0) AS total FROM DESCRIPTION_ORDER WHERE ID_ORDER = ?`,
    [orderId]
  )
  const [sumEntregado] = await pool.query(
    `SELECT IFNULL(SUM(PESO),0) AS total
       FROM DESCRIPTION_DELIVERY dd
       JOIN ORDER_DELIVERY od ON od.ID_ORDER_DELIVERY = dd.ID_ORDER_DELIVERY
      WHERE od.ID_ORDER = ?`,
    [orderId]
  )

  return {
    ...headRows[0],
    lines: lineRows,
    pedidoPeso: Number(sumPedido[0].total || 0),
    entregadoPeso: Number(sumEntregado[0].total || 0),
    avanceEntrega: (() => {
      const p = Number(sumPedido[0].total || 0)
      const e = Number(sumEntregado[0].total || 0)
      return p > 0 ? Math.min(100, Math.round((e / p) * 100)) : 0
    })()
  }
}

export async function listOrders({ customerId, state, from, to, q, limit = 20, offset = 0 }) {
  const params = []
  const where = []

  if (customerId) { where.push('o.ID_CUSTOMER = ?'); params.push(customerId) }
  if (state)      { where.push('s.DESCRIPCION = ?');  params.push(state) }
  if (from)       { where.push('o.FECHA >= ?');       params.push(from) }
  if (to)         { where.push('o.FECHA < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(to) }
  if (q) {
    where.push('(c.RAZON_SOCIAL LIKE ? OR c.RUC LIKE ?)')
    params.push(`%${q}%`, `%${q}%`)
  }

  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''

  const [rows] = await pool.query(
    `SELECT o.ID_ORDER AS id,
            o.FECHA     AS fecha,
            c.RAZON_SOCIAL AS customerName,
            s.DESCRIPCION  AS state
       FROM ORDERS o
       JOIN CUSTOMERS c ON c.ID_CUSTOMER = o.ID_CUSTOMER
       JOIN STATES s ON s.ID_STATE = o.ID_STATE
       ${whereSql}
     ORDER BY o.FECHA DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  )

  return rows
}

export async function updateOrderState(orderId, newStateName) {
  const stateId = await getStateIdByName(newStateName)
  if (!stateId) throw Object.assign(new Error('STATE_NOT_FOUND'), { code: 'STATE_NOT_FOUND' })

  const [res] = await pool.query(
    `UPDATE ORDERS SET ID_STATE = ? WHERE ID_ORDER = ?`,
    [stateId, orderId]
  )
  return res.affectedRows > 0
}
// Marca el pedido como ENTREGADO si el total entregado >= total pedido.
// Si estaba ENTREGADO y ya no cumple, lo pasa a EN_PROCESO.
export async function markOrderDeliveredIfComplete(orderId) {
  const [[pedido]] = await pool.query(
    'SELECT IFNULL(SUM(PESO),0) AS total FROM DESCRIPTION_ORDER WHERE ID_ORDER = ?',
    [orderId]
  )
  const [[entregado]] = await pool.query(
    `SELECT IFNULL(SUM(dd.PESO),0) AS total
       FROM DESCRIPTION_DELIVERY dd
       JOIN ORDER_DELIVERY od ON od.ID_ORDER_DELIVERY = dd.ID_ORDER_DELIVERY
      WHERE od.ID_ORDER = ?`,
    [orderId]
  )
  const pedidoTotal = Number(pedido.total || 0)
  const entregadoTotal = Number(entregado.total || 0)

  // Lee estado actual
  const [[row]] = await pool.query(
    `SELECT o.ID_STATE, s.DESCRIPCION AS state
       FROM ORDERS o JOIN STATES s ON s.ID_STATE=o.ID_STATE
      WHERE o.ID_ORDER=?`,
    [orderId]
  )
  const current = row?.state

  if (pedidoTotal > 0 && entregadoTotal >= pedidoTotal) {
    // ENTREGADO
    await updateOrderState(orderId, 'ENTREGADO')
  } else if (current === 'ENTREGADO') {
    // Si dejaron de cumplir (ediciones), baja a EN_PROCESO
    await updateOrderState(orderId, 'EN_PROCESO')
  }
}
export async function listOrdersInProcess({ q, limit = 50, offset = 0 }) {
  const params = []
  let where = ` WHERE s.DESCRIPCION = 'EN_PROCESO' `
  if (q) {
    where += ' AND (c.RAZON_SOCIAL LIKE ? OR p.DESCRIPCION LIKE ?)'
    params.push(`%${q}%`, `%${q}%`)
  }

  const [[{ total }]] = await pool.query(
    `
    SELECT COUNT(*) total
    FROM ORDERS o
    JOIN STATES s ON s.ID_STATE = o.ID_STATE
    JOIN CUSTOMERS c ON c.ID_CUSTOMER = o.ID_CUSTOMER
    LEFT JOIN DESCRIPTION_ORDER do2 ON do2.ID_ORDER = o.ID_ORDER
    LEFT JOIN PRODUCTS p ON p.ID_PRODUCT = do2.ID_PRODUCT
    ${where}
    `, params
  )

  const [rows] = await pool.query(
    `
    SELECT
      o.ID_ORDER         AS id,
      o.FECHA            AS fecha,
      c.RAZON_SOCIAL     AS customerName,
      s.DESCRIPCION      AS state
    FROM ORDERS o
    JOIN STATES s ON s.ID_STATE = o.ID_STATE
    JOIN CUSTOMERS c ON c.ID_CUSTOMER = o.ID_CUSTOMER
    ${where}
    ORDER BY o.FECHA DESC, o.ID_ORDER DESC
    LIMIT ? OFFSET ?
    `,
    [...params, Number(limit), Number(offset)]
  )

  return { items: rows, total: Number(total || 0) }
}