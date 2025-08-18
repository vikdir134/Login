import { pool } from '../db.js'
import Supplier from './entities/Supplier.js'

export class SuppliersModel {
  static async list({ q, active } = {}) {
    const where = []
    const params = []
    if (q?.trim()) {
      where.push('(NAME LIKE ? OR RUC LIKE ?)')
      params.push(`%${q}%`, `%${q}%`)
    }
    if (active === '0' || active === '1' || active === 0 || active === 1) {
      where.push('ACTIVE = ?')
      params.push(Number(active))
    }
    const sql = `
      SELECT ID_SUPPLIER AS id, NAME AS name, RUC AS ruc, ADDRESS AS address,
             PHONE AS phone, EMAIL AS email, CONTACT_PERSON AS contactPerson,
             ACTIVE AS active, CREATED_AT AS createdAt
      FROM SUPPLIERS
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY NAME ASC
    `
    const [rows] = await pool.query(sql, params)
    return rows.map(r => new Supplier(r))
  }

  static async get(id) {
    const [rows] = await pool.query(
      `SELECT ID_SUPPLIER AS id, NAME AS name, RUC AS ruc, ADDRESS AS address,
              PHONE AS phone, EMAIL AS email, CONTACT_PERSON AS contactPerson,
              ACTIVE AS active, CREATED_AT AS createdAt
       FROM SUPPLIERS WHERE ID_SUPPLIER = ?`, [id]
    )
    return rows[0] ? new Supplier(rows[0]) : null
  }

  static async create(data) {
    const { name, ruc, address, phone, email, contactPerson, active = 1 } = data
    const [res] = await pool.query(
      `INSERT INTO SUPPLIERS (NAME, RUC, ADDRESS, PHONE, EMAIL, CONTACT_PERSON, ACTIVE)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, ruc, address, phone, email, contactPerson, active ? 1 : 0]
    )
    return this.get(res.insertId)
  }

  static async update(id, data) {
    const sets = [], params = []
    for (const [k, v] of Object.entries({
      NAME: data.name, RUC: data.ruc, ADDRESS: data.address, PHONE: data.phone,
      EMAIL: data.email, CONTACT_PERSON: data.contactPerson,
      ACTIVE: data.active === undefined ? undefined : (data.active ? 1 : 0)
    })) {
      if (v !== undefined) { sets.push(`${k}=?`); params.push(v) }
    }
    if (!sets.length) return this.get(id)
    params.push(id)
    await pool.query(`UPDATE SUPPLIERS SET ${sets.join(', ')} WHERE ID_SUPPLIER=?`, params)
    return this.get(id)
  }

  static async remove(id) {
    const [res] = await pool.query(`DELETE FROM SUPPLIERS WHERE ID_SUPPLIER=?`, [id])
    return res.affectedRows > 0
  }
}
