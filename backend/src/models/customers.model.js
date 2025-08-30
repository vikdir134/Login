// backend/src/models/customers.model.js
import { pool } from '../db.js'

// Lista básica con búsqueda por RUC / Razón social
export async function listCustomersBasic({ q, limit = 50 }) {
  let sql = `
    SELECT
      c.ID_CUSTOMER   AS id,
      c.RUC,
      c.RAZON_SOCIAL  AS razonSocial,
      c.ACTIVO        AS activo
    FROM CUSTOMERS c
  `
  const params = []

  if (q && q.trim()) {
    sql += ` WHERE c.RUC LIKE ? OR c.RAZON_SOCIAL LIKE ?`
    params.push(`%${q}%`, `%${q}%`)
  }

  sql += ` ORDER BY c.RAZON_SOCIAL ASC LIMIT ?`
  params.push(Number(limit))

  const [rows] = await pool.query(sql, params)
  return rows
}

// Cliente por id
export async function findCustomerById(id) {
  const [rows] = await pool.query(
    `SELECT
       c.ID_CUSTOMER   AS id,
       c.RUC,
       c.RAZON_SOCIAL  AS razonSocial,
       c.ACTIVO        AS activo,
       c.CREATED_AT    AS createdAt
     FROM CUSTOMERS c
     WHERE c.ID_CUSTOMER = ?`,
    [id]
  )
  return rows[0] || null
}

// Pedidos del cliente (resumen)
export async function listOrdersByCustomer(customerId) {
  const [rows] = await pool.query(
    `SELECT
       o.ID_ORDER     AS id,
       o.FECHA        AS fecha,
       s.DESCRIPCION  AS state
     FROM ORDERS o
     JOIN STATES s ON s.ID_STATE = o.ID_STATE
     WHERE o.ID_CUSTOMER = ?
     ORDER BY o.FECHA DESC
     LIMIT 200`,
    [customerId]
  )
  return rows
}

// === NUEVO: crear cliente ===
export async function createCustomerBasic({ RUC, razonSocial, activo = true }) {
  if (!RUC || !razonSocial) {
    const e = new Error('RUC y Razón social son obligatorios')
    e.code = 'BAD_INPUT'
    throw e
  }
  const r = String(RUC).trim()
  const rs = String(razonSocial).trim()
  if (!/^\d{8,11}$/.test(r)) {
    const e = new Error('RUC debe tener entre 8 y 11 dígitos numéricos')
    e.code = 'BAD_INPUT'
    throw e
  }
  if (rs.length < 2 || rs.length > 60) {
    const e = new Error('Razón social debe tener entre 2 y 60 caracteres')
    e.code = 'BAD_INPUT'
    throw e
  }

  const [ins] = await pool.query(
    `INSERT INTO CUSTOMERS (RUC, RAZON_SOCIAL, ACTIVO)
     VALUES (?, ?, ?)`,
    [r, rs, activo ? 1 : 0]
  )
  const id = ins.insertId
  return { id, RUC: r, razonSocial: rs, activo: !!activo }
}
function buildWhereCustomer({ customerId, states, from, to }) {
  const where = [' o.ID_CUSTOMER = ? ']
  const params = [customerId]

  if (Array.isArray(states) && states.length) {
    where.push(` s.DESCRIPCION IN (${states.map(()=>'?').join(',')}) `)
    params.push(...states)
  }
  if (from) { where.push(' o.FECHA >= ? '); params.push(from + ' 00:00:00') }
  if (to)   { where.push(' o.FECHA <= ? '); params.push(to   + ' 23:59:59') }

  return { whereSql: ' WHERE ' + where.join(' AND '), params }
}

// === KPIs por cliente con filtros (estados, fecha pedido) ===
export async function getCustomerKPIs({ customerId, states, from, to, igv = 0.18 }) {
  const { whereSql, params } = buildWhereCustomer({ customerId, states, from, to })

 // 1) # pedidos y última fecha
  const [[rowA]] = await pool.query(
    `SELECT COUNT(*) AS ordersCount, MAX(o.FECHA) AS lastOrderDate
       FROM ORDERS o
       JOIN STATES s ON s.ID_STATE = o.ID_STATE
      ${whereSql}`,
    params
  )

  // 2) kilos: pedido vs entregado (de los pedidos filtrados)
  const [[rowPedido]] = await pool.query(
    `SELECT IFNULL(SUM(d.PESO),0) AS pedidoKg
       FROM ORDERS o
       JOIN STATES s ON s.ID_STATE = o.ID_STATE
       JOIN DESCRIPTION_ORDER d ON d.ID_ORDER = o.ID_ORDER
      ${whereSql}`,
    params
  )
  const [[rowEntregado]] = await pool.query(
    `SELECT IFNULL(SUM(dd.PESO),0) AS entregadoKg
       FROM ORDERS o
       JOIN STATES s ON s.ID_STATE = o.ID_STATE
       JOIN ORDER_DELIVERY od ON od.ID_ORDER = o.ID_ORDER
       JOIN DESCRIPTION_DELIVERY dd ON dd.ID_ORDER_DELIVERY = od.ID_ORDER_DELIVERY
      ${whereSql}`,
    params
  )

  // 3) monto por moneda → TOTAL con IGV
  const [rowsAmount] = await pool.query(
    `SELECT
       COALESCE(NULLIF(dd.CURRENCY,''), 'PEN')                      AS currency,
       IFNULL(SUM(dd.SUBTOTAL),0)                                   AS subtotal,
       ROUND(IFNULL(SUM(dd.SUBTOTAL),0) * (1 + ?), 2)               AS total
     FROM ORDERS o
     JOIN STATES s ON s.ID_STATE = o.ID_STATE
     LEFT JOIN ORDER_DELIVERY od ON od.ID_ORDER = o.ID_ORDER
     LEFT JOIN DESCRIPTION_DELIVERY dd ON dd.ID_ORDER_DELIVERY = od.ID_ORDER_DELIVERY
     ${whereSql}
     GROUP BY COALESCE(NULLIF(dd.CURRENCY,''), 'PEN')`,
    [igv, ...params]
  )
  const totalByCurrency = {}
  for (const r of rowsAmount) totalByCurrency[r.currency] = Number(r.total || 0)

  // 4) pendientes (cuenta en ese filtro con estado PENDIENTE)
  const [[rowPend]] = await pool.query(
    `SELECT COUNT(*) AS pendingCount
       FROM ORDERS o
       JOIN STATES s ON s.ID_STATE = o.ID_STATE
      ${whereSql} AND s.DESCRIPCION='PENDIENTE'`,
    params
  )

  const pedidoKg = Number(rowPedido?.pedidoKg || 0)
  const entregadoKg = Number(rowEntregado?.entregadoKg || 0)
  const fulfillmentPct = pedidoKg > 0 ? Math.round((entregadoKg / pedidoKg) * 100) : 0

  return {
    ordersCount: Number(rowA?.ordersCount || 0),
    lastOrderDate: rowA?.lastOrderDate || null,
    totalByCurrency,         // ← ahora es TOTAL (con IGV)
    pedidoKg,
    entregadoKg,
    fulfillmentPct,
    pendingCount: Number(rowPend?.pendingCount || 0)
  }
}

// === Listado de pedidos (del cliente) con TOTAL por pedido ===
export async function listCustomerOrdersWithTotals({
  customerId, states, from, to, limit = 10, offset = 0, igv = 0.18
}) {
  const { whereSql, params } = buildWhereCustomer({ customerId, states, from, to })

  // total pedidos para paginar
  const [[t]] = await pool.query(
    `SELECT COUNT(*) AS total
       FROM ORDERS o
       JOIN STATES s ON s.ID_STATE = o.ID_STATE
      ${whereSql}`,
    params
  )

  // items con TOTAL por pedido (SUBTOTAL * (1+IGV)) + moneda
  const [rows] = await pool.query(
    `SELECT
       o.ID_ORDER                                                AS id,
       o.FECHA                                                   AS fecha,
       s.DESCRIPCION                                             AS state,
       IFNULL(SUM(dd.SUBTOTAL),0)                                AS subtotal,
       ROUND(IFNULL(SUM(dd.SUBTOTAL),0) * (1 + ?), 2)            AS total,
       COALESCE(NULLIF(MIN(dd.CURRENCY),''), 'PEN')              AS currency
     FROM ORDERS o
     JOIN STATES s ON s.ID_STATE = o.ID_STATE
     LEFT JOIN ORDER_DELIVERY od ON od.ID_ORDER = o.ID_ORDER
     LEFT JOIN DESCRIPTION_DELIVERY dd ON dd.ID_ORDER_DELIVERY = od.ID_ORDER_DELIVERY
     ${whereSql}
     GROUP BY o.ID_ORDER, o.FECHA, s.DESCRIPCION
     ORDER BY o.FECHA DESC, o.ID_ORDER DESC
     LIMIT ? OFFSET ?`,
    [igv, ...params, Number(limit), Number(offset)]
  )

  return {
    items: rows.map(r => ({
      id: r.id,
      fecha: r.fecha,
      state: r.state,
      total: Number(r.total || 0),         // ← TOTAL real
      currency: r.currency || 'PEN'
    })),
    total: Number(t?.total || 0)
  }
}