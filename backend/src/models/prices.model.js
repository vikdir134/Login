import { pool } from '../db.js'
function ymd(d) {
  // normaliza a 'YYYY-MM-DD'
  return (d || new Date()).toISOString().slice(0,10)
}

export async function getEffectivePrice({ customerId, productId, atDate }) {
  const [rows] = await pool.query(
    `SELECT ID_PRICE, PRICE, CURRENCY, VALID_FROM, VALID_TO
       FROM CUSTOMER_PRODUCT_PRICES
      WHERE ID_CUSTOMER = ? AND ID_PRODUCT = ?
        AND VALID_FROM <= ?
        AND (VALID_TO IS NULL OR VALID_TO >= ?)
      ORDER BY VALID_FROM DESC
      LIMIT 1`,
    [customerId, productId, atDate, atDate]
  )
  return rows?.[0] || null
}

/**
 * Política:
 * - Si ya hay una fila exactamente con VALID_FROM = atDate -> UPDATE (no insertamos).
 * - Si hay un vigente distinto -> cerramos el vigente (VALID_TO = atDate - 1 día) e insertamos uno nuevo con atDate.
 * - Si no hay vigente -> insertamos.
 */
export async function upsertCustomerProductPrice({
  customerId,
  productId,
  price,
  currency = 'PEN',
  atDate = ymd()
}, connExternal = null) {
  const useConn = connExternal || await pool.getConnection()
  const mustRelease = !connExternal

  try {
    // Trae la fila vigente o la más reciente que toque atDate
    const [rows] = await useConn.query(
      `SELECT *
         FROM CUSTOMER_PRODUCT_PRICES
        WHERE ID_CUSTOMER=? AND ID_PRODUCT=?
          AND (VALID_TO IS NULL OR VALID_TO >= ?)
        ORDER BY VALID_FROM DESC
        LIMIT 1`,
      [customerId, productId, atDate]
    )

    const current = rows[0]
    const p = Number(price)

    if (!current) {
      // No hay vigente → inserta nueva vigente
      await useConn.query(
        `INSERT INTO CUSTOMER_PRODUCT_PRICES
           (ID_CUSTOMER, ID_PRODUCT, PRICE, CURRENCY, VALID_FROM, VALID_TO)
         VALUES (?, ?, ?, ?, ?, NULL)`,
        [customerId, productId, p, currency, atDate]
      )
      return
    }

    const samePrice  = Number(current.PRICE) === p
    const sameCurr   = (current.CURRENCY || 'PEN') === currency
    const currFrom   = current.VALID_FROM.toISOString().slice(0,10)
    const currTo     = current.VALID_TO ? current.VALID_TO.toISOString().slice(0,10) : null

    if (samePrice && sameCurr && currTo === null) {
      // Ya hay una vigente idéntica → no-op
      return
    }

    // Si la vigente empieza justo en atDate → solo UPDATE de precio/moneda
    if (currFrom === atDate && currTo === null) {
      await useConn.query(
        `UPDATE CUSTOMER_PRODUCT_PRICES
            SET PRICE=?, CURRENCY=?
          WHERE ID_PRICE=?`,
        [p, currency, current.ID_PRICE]
      )
      return
    }

    // Si la vigente empezó antes de atDate → cerramos y creamos nueva
    if (currFrom < atDate && currTo === null) {
      await useConn.query(
        `UPDATE CUSTOMER_PRODUCT_PRICES
            SET VALID_TO = DATE_SUB(?, INTERVAL 1 DAY)
          WHERE ID_PRICE=?`,
        [atDate, current.ID_PRICE]
      )
      await useConn.query(
        `INSERT INTO CUSTOMER_PRODUCT_PRICES
           (ID_CUSTOMER, ID_PRODUCT, PRICE, CURRENCY, VALID_FROM, VALID_TO)
         VALUES (?, ?, ?, ?, ?, NULL)`,
        [customerId, productId, p, currency, atDate]
      )
      return
    }

    // Caso menos común: la “vigente” empieza DESPUÉS de atDate (traíamos la más reciente >= atDate).
    // Metemos un segmento previo que termine el día anterior a la que empieza.
    if (currFrom > atDate) {
      await useConn.query(
        `INSERT INTO CUSTOMER_PRODUCT_PRICES
           (ID_CUSTOMER, ID_PRODUCT, PRICE, CURRENCY, VALID_FROM, VALID_TO)
         VALUES (?, ?, ?, ?, ?, DATE_SUB(?, INTERVAL 1 DAY))`,
        [customerId, productId, p, currency, atDate, currFrom]
      )
      return
    }
  } finally {
    if (mustRelease) useConn.release()
  }
}
