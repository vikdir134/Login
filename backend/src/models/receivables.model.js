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
 * Lista clientes con sus totales de cuentas por cobrar en PEN
 */
export async function listCustomersWithDebt({ q, balance = 'all', limit = 30, offset = 0 }) {
  const { where, params } = buildCustomerWhere({ q })

  const baseSql = `
    SELECT
      c.ID_CUSTOMER                                  AS customerId,
      c.RAZON_SOCIAL                                 AS customerName,
      c.RUC                                          AS RUC,
      IFNULL(SUM(dd.SUBTOTAL), 0) * (1 + ${IGV_RATE})  AS totalPedidosPEN,
      IFNULL((
        SELECT SUM(p.AMOUNT)
        FROM PAYMENTS p
        WHERE p.ID_CUSTOMER = c.ID_CUSTOMER AND p.CURRENCY = 'PEN'
      ), 0)                                          AS totalPagadoPEN
    FROM CUSTOMERS c
    LEFT JOIN ORDERS o              ON o.ID_CUSTOMER = c.ID_CUSTOMER
    LEFT JOIN ORDER_DELIVERY od     ON od.ID_ORDER = o.ID_ORDER
    LEFT JOIN DESCRIPTION_DELIVERY dd
           ON dd.ID_ORDER_DELIVERY = od.ID_ORDER_DELIVERY
          AND dd.CURRENCY='PEN'
    ${where}
    GROUP BY c.ID_CUSTOMER, c.RAZON_SOCIAL, c.RUC
  `

  const having =
    balance === 'with'
      ? 'WHERE (t.totalPedidosPEN - t.totalPagadoPEN) > 0.000001'
      : balance === 'without'
      ? 'WHERE ABS(t.totalPedidosPEN - t.totalPagadoPEN) <= 0.000001'
      : ''

  const countSql = `
    SELECT COUNT(*) AS total
    FROM (
      SELECT customerId, totalPedidosPEN, totalPagadoPEN FROM (${baseSql}) t
    ) t
    ${having}
  `
  const [[{ total }]] = await pool.query(countSql, params)

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
 * Detalle de CxC por cliente (por ENTREGAS)
 * → Pagos sumados por ID_ORDER_DELIVERY (no por pedido).
 */
export async function getCustomerReceivable({ customerId, balance='all', from, to }) {
  // ---------- CABECERA ----------
  const paramsHead = [customerId]
  let whereDateHead = ''
  if (from) { whereDateHead += ' AND od.FECHA >= ? '; paramsHead.push(from + ' 00:00:00') }
  if (to)   { whereDateHead += ' AND od.FECHA <= ? '; paramsHead.push(to   + ' 23:59:59') }

  const [[head]] = await pool.query(
    `
    SELECT
      c.ID_CUSTOMER  AS customerId,
      c.RAZON_SOCIAL AS customerName,
      c.RUC          AS RUC,
      IFNULL(SUM(dd.SUBTOTAL),0) * (1 + ${IGV_RATE}) AS totalPedidosPEN,
      IFNULL((
        SELECT SUM(p.AMOUNT)
        FROM PAYMENTS p
        WHERE p.ID_CUSTOMER = c.ID_CUSTOMER AND p.CURRENCY='PEN'
      ),0) AS totalPagadoPEN
    FROM CUSTOMERS c
    LEFT JOIN ORDERS o          ON o.ID_CUSTOMER = c.ID_CUSTOMER
    LEFT JOIN ORDER_DELIVERY od ON od.ID_ORDER = o.ID_ORDER
    LEFT JOIN DESCRIPTION_DELIVERY dd
           ON dd.ID_ORDER_DELIVERY = od.ID_ORDER_DELIVERY
          AND dd.CURRENCY='PEN'
    WHERE c.ID_CUSTOMER = ? ${whereDateHead}
    `,
    paramsHead
  )

  const totalPedidosPEN = Number(head?.totalPedidosPEN || 0)
  const totalPagadoPEN  = Number(head?.totalPagadoPEN  || 0)
  const saldoPEN        = +(totalPedidosPEN - totalPagadoPEN).toFixed(2)

  // ---------- DETALLE POR ENTREGA ----------
  const paramsDet = [customerId]
  let whereDateDet = ''
  if (from) { whereDateDet += ' AND od.FECHA >= ? '; paramsDet.push(from + ' 00:00:00') }
  if (to)   { whereDateDet += ' AND od.FECHA <= ? '; paramsDet.push(to   + ' 23:59:59') }

  const [rows] = await pool.query(
    `
    SELECT
      /* claves */
      od.ID_ORDER_DELIVERY                                      AS deliveryId,
      o.ID_ORDER                                                AS orderId,
      od.FECHA                                                  AS fecha,
      /* documentos */
      f.CODIGO                                                  AS invoiceCode,
      f.ARCHIVO_PATH                                            AS invoicePath,
      g.CODIGO                                                  AS guiaCode,
      g.ARCHIVO_PATH                                            AS guiaPath,
      /* montos */
      IFNULL(tot.totalEntrega,0) * (1 + ${IGV_RATE})            AS total,
      IFNULL(payd.totalPagadoEntrega,0)                         AS pagado,
      (IFNULL(tot.totalEntrega,0) * (1 + ${IGV_RATE}) - IFNULL(payd.totalPagadoEntrega,0)) AS saldo
    FROM ORDER_DELIVERY od
    JOIN ORDERS o           ON o.ID_ORDER = od.ID_ORDER
    JOIN CUSTOMERS c        ON c.ID_CUSTOMER = o.ID_CUSTOMER
    LEFT JOIN FACTURAS f    ON f.ID_FACTURA = od.ID_FACTURA
    LEFT JOIN GUIAS g       ON g.ID_GUIA    = od.ID_GUIA
    /* total por ENTREGA (solo PEN) */
    LEFT JOIN (
      SELECT dd.ID_ORDER_DELIVERY, SUM(dd.SUBTOTAL) AS totalEntrega
      FROM DESCRIPTION_DELIVERY dd
      WHERE dd.CURRENCY = 'PEN'
      GROUP BY dd.ID_ORDER_DELIVERY
    ) tot ON tot.ID_ORDER_DELIVERY = od.ID_ORDER_DELIVERY
    /* pagos por ENTREGA (solo los que están ligados a la entrega) */
    LEFT JOIN (
      SELECT p.ID_ORDER_DELIVERY, SUM(p.AMOUNT) AS totalPagadoEntrega
      FROM PAYMENTS p
      WHERE p.CURRENCY = 'PEN' AND p.ID_ORDER_DELIVERY IS NOT NULL
      GROUP BY p.ID_ORDER_DELIVERY
    ) payd ON payd.ID_ORDER_DELIVERY = od.ID_ORDER_DELIVERY
    WHERE c.ID_CUSTOMER = ? ${whereDateDet}
    ORDER BY od.FECHA DESC, od.ID_ORDER_DELIVERY DESC
    `,
    paramsDet
  )

  // Filtro por balance si se pidió
  let items = rows
  if (balance === 'with')         items = items.filter(r => Number(r.saldo) >  0.000001)
  else if (balance === 'without') items = items.filter(r => Math.abs(Number(r.saldo)) <= 0.000001)

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
 * Resumen global
 */
export async function getReceivablesSummary() {
  const [[r]] = await pool.query(
    `
    SELECT
      IFNULL(SUM(dd.SUBTOTAL),0) * (1 + ${IGV_RATE}) AS totalPedidosPEN,
      IFNULL((SELECT SUM(p.AMOUNT) FROM PAYMENTS p WHERE p.CURRENCY='PEN'),0) AS totalPagadoPEN
    FROM ORDER_DELIVERY od
    JOIN DESCRIPTION_DELIVERY dd
      ON dd.ID_ORDER_DELIVERY = od.ID_ORDER_DELIVERY
     AND dd.CURRENCY='PEN'
    `
  )
  const totalPedidosPEN = Number(r?.totalPedidosPEN || 0)
  const totalPagadoPEN  = Number(r?.totalPagadoPEN  || 0)
  const saldoPEN        = +(totalPedidosPEN - totalPagadoPEN).toFixed(2)

  return {
    totalPedidosPEN: +totalPedidosPEN.toFixed(2),
    totalPagadoPEN:  +totalPagadoPEN.toFixed(2),
    saldoPEN
  }
}

// Alias para mantener compatibilidad con el controller
export { getCustomerReceivable as getCustomerReceivableByDeliveries }
