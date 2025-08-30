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
export async function listCustomersWithDebt({ q, onlyWithDebt = false, limit = 30, offset = 0 }) {
  const { where, params } = buildCustomerWhere({ q })

  // Base agregada por cliente
  // NOTA: restringimos a PEN; si luego manejas multi-moneda, agrégalo por currency.
  const baseSql = `
    SELECT
      c.ID_CUSTOMER                                AS customerId,
      c.RAZON_SOCIAL                               AS customerName,
      c.RUC                                        AS RUC,
      IFNULL(SUM(dd.SUBTOTAL), 0)                  AS subtotalSumPEN,
      -- total con IGV:
      IFNULL(SUM(dd.SUBTOTAL), 0) * (1 + ${IGV_RATE}) AS totalPedidosPEN,
      -- pagos:
      IFNULL((
        SELECT SUM(p.AMOUNT)
        FROM PAYMENTS p
        WHERE p.ID_CUSTOMER = c.ID_CUSTOMER AND p.CURRENCY = 'PEN'
      ), 0)                                        AS totalPagadoPEN
    FROM CUSTOMERS c
    LEFT JOIN ORDERS o            ON o.ID_CUSTOMER = c.ID_CUSTOMER
    LEFT JOIN ORDER_DELIVERY od   ON od.ID_ORDER = o.ID_ORDER
    LEFT JOIN DESCRIPTION_DELIVERY dd ON dd.ID_ORDER_DELIVERY = od.ID_ORDER_DELIVERY AND dd.CURRENCY = 'PEN'
    ${where}
    GROUP BY c.ID_CUSTOMER, c.RAZON_SOCIAL, c.RUC
  `

  // Conteo total (aplicando HAVING si estuviera activo "solo con saldo")
  const countSql = `
    SELECT COUNT(*) AS total
    FROM (
      ${baseSql}
    ) t
    ${onlyWithDebt ? 'WHERE (t.totalPedidosPEN - t.totalPagadoPEN) > 0.000001' : ''}
  `
  const [[{ total }]] = await pool.query(countSql, params)

  // Datos paginados
  const dataSql = `
    SELECT
      customerId, customerName, RUC,
      totalPedidosPEN,
      totalPagadoPEN,
      (totalPedidosPEN - totalPagadoPEN) AS saldoPEN
    FROM (
      ${baseSql}
    ) x
    ${onlyWithDebt ? 'WHERE (x.totalPedidosPEN - x.totalPagadoPEN) > 0.000001' : ''}
    ORDER BY saldoPEN DESC, customerName ASC
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
export async function getCustomerReceivable({ customerId, onlyWithBalance = false }) {
  // Cabecera (agregado del cliente)
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
    LEFT JOIN ORDERS o              ON o.ID_CUSTOMER = c.ID_CUSTOMER
    LEFT JOIN ORDER_DELIVERY od     ON od.ID_ORDER = o.ID_ORDER
    LEFT JOIN DESCRIPTION_DELIVERY dd ON dd.ID_ORDER_DELIVERY = od.ID_ORDER_DELIVERY AND dd.CURRENCY='PEN'
    WHERE c.ID_CUSTOMER = ?
    `,
    [customerId]
  )

  const totalPedidosPEN = Number(head?.totalPedidosPEN || 0)
  const totalPagadoPEN  = Number(head?.totalPagadoPEN  || 0)
  const saldoPEN        = +(totalPedidosPEN - totalPagadoPEN).toFixed(2)

  // Detalle por pedido (mismos criterios)
  const [detalle] = await pool.query(
    `
    SELECT
      o.ID_ORDER AS orderId,
      o.FECHA    AS fecha,
      s.DESCRIPCION AS estado,
      -- subtotal del pedido:
      IFNULL(tot.subtotalPedido,0) AS subtotalPedido,
      -- total con IGV:
      IFNULL(tot.subtotalPedido,0) * (1 + ${IGV_RATE}) AS total,
      -- pagado por pedido:
      IFNULL(pay.totalPagado,0) AS pagado,
      -- saldo por pedido (con IGV):
      (IFNULL(tot.subtotalPedido,0) * (1 + ${IGV_RATE}) - IFNULL(pay.totalPagado,0)) AS saldo,
      inv.invoices
    FROM ORDERS o
    JOIN STATES s ON s.ID_STATE = o.ID_STATE

    -- subtotal por pedido (solo PEN aquí)
    LEFT JOIN (
      SELECT
        od.ID_ORDER,
        SUM(dd.SUBTOTAL) AS subtotalPedido
      FROM ORDER_DELIVERY od
      JOIN DESCRIPTION_DELIVERY dd ON dd.ID_ORDER_DELIVERY = od.ID_ORDER_DELIVERY AND dd.CURRENCY='PEN'
      GROUP BY od.ID_ORDER
    ) tot ON tot.ID_ORDER = o.ID_ORDER

    -- pagos por pedido (PEN)
    LEFT JOIN (
      SELECT p.ID_ORDER, SUM(p.AMOUNT) AS totalPagado
      FROM PAYMENTS p
      WHERE p.CURRENCY='PEN'
      GROUP BY p.ID_ORDER
    ) pay ON pay.ID_ORDER = o.ID_ORDER

    -- facturas vinculadas (si existen)
    LEFT JOIN (
      SELECT od.ID_ORDER, GROUP_CONCAT(DISTINCT f.CODIGO ORDER BY f.CODIGO SEPARATOR ', ') AS invoices
      FROM ORDER_DELIVERY od
      JOIN FACTURAS f ON f.ID_FACTURA = od.ID_FACTURA
      GROUP BY od.ID_ORDER
    ) inv ON inv.ID_ORDER = o.ID_ORDER

    WHERE o.ID_CUSTOMER = ?
    ORDER BY o.FECHA DESC, o.ID_ORDER DESC
    `,
    [customerId]
  )

  const items = (onlyWithBalance ? detalle.filter(d => Number(d.saldo) > 0.000001) : detalle)
    .map(r => ({
      ...r,
      // redondeo bonito
      total: +(Number(r.total || 0)).toFixed(2),
      pagado: +(Number(r.pagado || 0)).toFixed(2),
      saldo: +(Number(r.saldo || 0)).toFixed(2),
    }))

  return {
    customerId,
    customerName: head?.customerName || '',
    RUC: head?.RUC || '',
    totalPedidosPEN: +totalPedidosPEN.toFixed(2),
    totalPagadoPEN: +totalPagadoPEN.toFixed(2),
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
