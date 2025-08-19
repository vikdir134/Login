import { pool } from '../db.js'

export class SuppliersModel {
  static async list({ q = '', limit = 50, offset = 0 } = {}) {
    const like = `%${q}%`
    const [rows] = await pool.query(
      `SELECT ID_SUPPLIER AS id, RUC, NAME AS name, ADDRESS, PHONE, EMAIL, CONTACT_PERSON AS contact, ACTIVE
       FROM SUPPLIERS
       WHERE (? = '' OR NAME LIKE ? OR RUC LIKE ?)
       ORDER BY NAME ASC
       LIMIT ? OFFSET ?`,
      [q, like, like, Number(limit), Number(offset)]
    )
    return rows
  }

  static async create({ ruc, name, address = null, phone = null, email = null, contact = null, active = 1 }) {
    const [res] = await pool.query(
      `INSERT INTO SUPPLIERS (RUC, NAME, ADDRESS, PHONE, EMAIL, CONTACT_PERSON, ACTIVE)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [ruc, name, address, phone, email, contact, active ? 1 : 0]
    )
    return { id: res.insertId, ruc, name, address, phone, email, contact, active: !!active }
  }
}
