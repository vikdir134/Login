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
