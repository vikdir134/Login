import { pool } from '../db.js'
import Customer from './entities/Customer.js'

export class CustomerModel {
  static async getAll({ q, activo } = {}) {
    const where = []
    const params = []

    if (q?.trim()) {
      where.push('(RUC LIKE ? OR RAZON_SOCIAL LIKE ?)')
      params.push(`%${q}%`, `%${q}%`)
    }
    if (activo === 0 || activo === 1 || activo === '0' || activo === '1') {
      where.push('ACTIVO = ?')
      params.push(Number(activo))
    }

    const sql = `
      SELECT
        ID_CUSTOMER   AS id,
        RUC           AS ruc,
        RAZON_SOCIAL  AS razonSocial,
        ACTIVO        AS activo,
        CREATED_AT    AS createdAt
      FROM CUSTOMERS
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY RAZON_SOCIAL ASC
    `
    const [rows] = await pool.query(sql, params)
    return rows.map(r => new Customer(r))
  }

  static async getById(id) {
    const [rows] = await pool.query(
      `SELECT ID_CUSTOMER AS id, RUC AS ruc, RAZON_SOCIAL AS razonSocial,
              ACTIVO AS activo, CREATED_AT AS createdAt
         FROM CUSTOMERS
        WHERE ID_CUSTOMER = ?`,
      [id]
    )
    if (rows.length === 0) return null
    return new Customer(rows[0])
  }

  static async create({ ruc, razonSocial, activo = 1 }) {
    const [res] = await pool.query(
      `INSERT INTO CUSTOMERS (RUC, RAZON_SOCIAL, ACTIVO)
       VALUES (?, ?, ?)`,
      [ruc, razonSocial, activo ? 1 : 0]
    )
    return this.getById(res.insertId)
  }

  static async update(id, { ruc, razonSocial, activo }) {
    const sets = []
    const params = []

    if (ruc !== undefined)         { sets.push('RUC=?');            params.push(ruc) }
    if (razonSocial !== undefined) { sets.push('RAZON_SOCIAL=?');   params.push(razonSocial) }
    if (activo !== undefined)      { sets.push('ACTIVO=?');         params.push(activo ? 1 : 0) }

    if (sets.length === 0) return this.getById(id)

    params.push(id)
    await pool.query(`UPDATE CUSTOMERS SET ${sets.join(', ')} WHERE ID_CUSTOMER=?`, params)
    return this.getById(id)
  }

  static async remove(id) {
    const [res] = await pool.query(`DELETE FROM CUSTOMERS WHERE ID_CUSTOMER=?`, [id])
    return res.affectedRows > 0
  }
}
