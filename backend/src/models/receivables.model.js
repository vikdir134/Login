// backend/src/models/receivables.model.js
import { pool } from '../db.js'

// IGV configurable (default 18%)
const IGV_RATE = Number(process.env.IGV_RATE ?? 0.18)

// Helper: arma WHERE para búsqueda por cliente (nombre/RUC)
function buildCustomerWhere({ q }) {
  const params = []
  let where = ' WHERE 1=1 '
  if (q && q.trim()) {
    where += ' AND (c.RAZON_SOCIAL LIKE ? OR c.RUC LIKE ?) '
    params.push(`%${q}%`, `%${q}%`)
  }
  return { where, params }
}

/**
 * Lista clientes con sus totales de cuentas por cobrar en PEN:
 * - totalPedidosPEN = SUM(subtotal)*(1+IGV_RATE)
 * - totalPagadoPEN  = SUM(pagos)
 * - saldoPEN        = total - pagado
 *
 * Soporta búsqueda (q) y "solo con saldo" (onlyWithDebt) desde SQL (HAVING).
 * Paginación: limit/offset sobre el agregado.
 */
export async function listCustomersWithDebt({ q, balance = 'all', limit = 30, offset = 0 }) {
  const { where, params } = buildCustomerWhere({ q })

  const baseSql = `
    SELECT
      c.ID_CUSTOMER                                AS customerId,
      c.RAZON_SOCIAL                               AS customerName,
      c.RUC                                        AS RUC,
      IFNULL(SUM(dd.SUBTOTAL), 0) * (1 + ${IGV_RATE}) AS totalPedidosPEN,
      IFNULL((
        SELECT SUM(p.AMOUNT)
        FROM PAYMENTS p
        WHERE p.ID_CUSTOMER = c.ID_CUSTOMER AND p.CURRENCY = 'PEN'
      ), 0)                                        AS totalPagadoPEN
    FROM CUSTOMERS c
    LEFT JOIN ORDERS o              ON o.ID_CUSTOMER = c.ID_CUSTOMER
    LEFT JOIN ORDER_DELIVERY od     ON od.ID_ORDER = o.ID_ORDER
    LEFT JOIN DESCRIPTION_DELIVERY dd ON dd.ID_ORDER_DELIVERY = od.ID_ORDER_DELIVERY AND dd.CURRENCY='PEN'
    ${where}
    GROUP BY c.ID_CUSTOMER, c.RAZON_SOCIAL, c.RUC
  `

  // WHERE/HAVING según balance
  const having =
    balance === 'with'
      ? 'WHERE (t.totalPedidosPEN - t.totalPagadoPEN) > 0.000001'
      : balance === 'without'
      ? 'WHERE ABS(t.totalPedidosPEN - t.totalPagadoPEN) <= 0.000001'
      : '' // all

  // total para paginación
  const countSql = `
    SELECT COUNT(*) AS total
    FROM (
      SELECT
        customerId,
        totalPedidosPEN,
        totalPagadoPEN
      FROM (${baseSql}) t
    ) t
    ${having}
  `
  const [[{ total }]] = await pool.query(countSql, params)

  // data paginada
  const dataSql = `
    SELECT
      t.customerId, t.customerName, t.RUC,
      t.totalPedidosPEN,
      t.totalPagadoPEN,
      (t.totalPedidosPEN - t.totalPagadoPEN) AS saldoPEN
    FROM (${baseSql}) t
    ${having}
    ORDER BY saldoPEN DESC, t.customerName ASC
    LIMIT ? OFFSET ?
  `
  const [rows] = await pool.query(dataSql, [...params, Number(limit), Number(offset)])
  return { items: rows, total: Number(total || 0) }
}


/**
 * Detalle de cuentas por cobrar de un cliente:
 * - Cabezera con total/pagado/saldo en PEN (total con IGV).
 * - Ítems por pedido con total (con IGV), pagado por pedido y saldo por pedido.
 * - Soporta onlyWithBalance (solo pedidos con saldo).
 */
// backend/src/models/receivables.model.js
export async function getCustomerReceivable({ customerId, balance='all', from, to }) {
  const paramsHead = [customerId]
  let whereDate = ''
  if (from) { whereDate += ' AND o.FECHA >= ? '; paramsHead.push(from + ' 00:00:00') }
  if (to)   { whereDate += ' AND o.FECHA <= ? '; paramsHead.push(to   + ' 23:59:59') }

  // HEADER: total con IGV (PEN)
  const [[head]] = await pool.query(
    `
    SELECT
      c.ID_CUSTOMER  AS customerId,
      c.RAZON_SOCIAL AS customerName,
      c.RUC          AS RUC,
      IFNULL(SUM(dd.SUBTOTAL),0) * (1 + ${IGV_RATE}) AS totalPedidosPEN,
      IFNULL((SELECT SUM(p.AMOUNT) FROM PAYMENTS p WHERE p.ID_CUSTOMER = c.ID_CUSTOMER AND p.CURRENCY='PEN'),0) AS totalPagadoPEN
    FROM CUSTOMERS c
    LEFT JOIN ORDERS o         ON o.ID_CUSTOMER = c.ID_CUSTOMER
    LEFT JOIN ORDER_DELIVERY od ON od.ID_ORDER = o.ID_ORDER
    LEFT JOIN DESCRIPTION_DELIVERY dd ON dd.ID_ORDER_DELIVERY = od.ID_ORDER_DELIVERY AND dd.CURRENCY='PEN'
    WHERE c.ID_CUSTOMER = ? ${whereDate}
    `,
    paramsHead
  )

  const totalPedidosPEN = Number(head?.totalPedidosPEN || 0)
  const totalPagadoPEN  = Number(head?.totalPagadoPEN  || 0)
  const saldoPEN        = +(totalPedidosPEN - totalPagadoPEN).toFixed(2)

  // DETALLE: **solo pedidos con entregas** y total con IGV
  const paramsDet = [customerId]
  let whereDateDet = ''
  if (from) { whereDateDet += ' AND o.FECHA >= ? '; paramsDet.push(from + ' 00:00:00') }
  if (to)   { whereDateDet += ' AND o.FECHA <= ? '; paramsDet.push(to   + ' 23:59:59') }

  const [detalle] = await pool.query(
    `
    SELECT
      o.ID_ORDER AS orderId,
      o.FECHA    AS fecha,
      s.DESCRIPCION AS estado,
      IFNULL(tot.totalPedido,0) * (1 + ${IGV_RATE}) AS total,        -- total con IGV
      IFNULL(pay.totalPagado,0)                     AS pagado,
      (IFNULL(tot.totalPedido,0) * (1 + ${IGV_RATE}) - IFNULL(pay.totalPagado,0)) AS saldo,
      inv.invoices
    FROM ORDERS o
    JOIN STATES s ON s.ID_STATE = o.ID_STATE
    /* 👇 Este JOIN asegura que el pedido tenga al menos una entrega */
    JOIN ORDER_DELIVERY od ON od.ID_ORDER = o.ID_ORDER
    LEFT JOIN (
      SELECT od.ID_ORDER, SUM(dd.SUBTOTAL) AS totalPedido
      FROM ORDER_DELIVERY od
      JOIN DESCRIPTION_DELIVERY dd ON dd.ID_ORDER_DELIVERY = od.ID_ORDER_DELIVERY AND dd.CURRENCY='PEN'
      GROUP BY od.ID_ORDER
    ) tot ON tot.ID_ORDER = o.ID_ORDER
    LEFT JOIN (
      SELECT p.ID_ORDER, SUM(p.AMOUNT) AS totalPagado
      FROM PAYMENTS p
      WHERE p.CURRENCY='PEN'
      GROUP BY p.ID_ORDER
    ) pay ON pay.ID_ORDER = o.ID_ORDER
    LEFT JOIN (
      SELECT od.ID_ORDER, GROUP_CONCAT(DISTINCT f.CODIGO ORDER BY f.CODIGO SEPARATOR ', ') AS invoices
      FROM ORDER_DELIVERY od
      JOIN FACTURAS f ON f.ID_FACTURA = od.ID_FACTURA
      GROUP BY od.ID_ORDER
    ) inv ON inv.ID_ORDER = o.ID_ORDER
    WHERE o.ID_CUSTOMER = ? ${whereDateDet}
    GROUP BY o.ID_ORDER, o.FECHA, s.DESCRIPCION, tot.totalPedido, pay.totalPagado, inv.invoices
    ORDER BY o.FECHA DESC, o.ID_ORDER DESC
    `,
    paramsDet
  )

  let items = detalle
  if (balance === 'with')       items = items.filter(d => Number(d.saldo) > 0.000001)
  else if (balance === 'without') items = items.filter(d => Math.abs(Number(d.saldo)) <= 0.000001)

  return {
    customerId,
    customerName: head?.customerName || '',
    RUC: head?.RUC || '',
    totalPedidosPEN,
    totalPagadoPEN,
    saldoPEN,
    items
  }
}



/**
 * Resumen global: totales con IGV vs pagos (PEN).
 */
export async function getReceivablesSummary() {
  const [[r]] = await pool.query(
    `
    SELECT
      IFNULL(SUM(dd.SUBTOTAL),0) * (1 + ${IGV_RATE}) AS totalPedidosPEN,
      IFNULL((SELECT SUM(p.AMOUNT) FROM PAYMENTS p WHERE p.CURRENCY='PEN'),0) AS totalPagadoPEN
    FROM ORDER_DELIVERY od
    JOIN DESCRIPTION_DELIVERY dd ON dd.ID_ORDER_DELIVERY = od.ID_ORDER_DELIVERY AND dd.CURRENCY='PEN'
    `
  )
  const totalPedidosPEN = Number(r?.totalPedidosPEN || 0)
  const totalPagadoPEN  = Number(r?.totalPagadoPEN  || 0)
  const saldoPEN        = +(totalPedidosPEN - totalPagadoPEN).toFixed(2)

  return { totalPedidosPEN: +totalPedidosPEN.toFixed(2), totalPagadoPEN: +totalPagadoPEN.toFixed(2), saldoPEN }
}
