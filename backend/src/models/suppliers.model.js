// src/models/suppliers.model.js
import { pool } from '../db.js'

export class SuppliersModel {
  static async list({ q = '', limit = 50, offset = 0, active = undefined }) {
    const params = []
    let where = ' WHERE 1=1 '
    if (q) { where += ' AND (NAME LIKE ? OR RUC LIKE ?) '; params.push(`%${q}%`, `%${q}%`) }
    if (active !== undefined) { where += ' AND ACTIVE = ? '; params.push(active ? 1 : 0) }

    const [rows] = await pool.query(
      `SELECT
         ID_SUPPLIER AS id,
         NAME       AS name,
         RUC        AS ruc,
         ADDRESS    AS address,
         PHONE      AS phone,
         EMAIL      AS email,
         CONTACT_PERSON AS contact,
         ACTIVE     AS active
       FROM SUPPLIERS
       ${where}
       ORDER BY NAME ASC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    )
    return rows
  }

  static async create({ name, ruc = null, address = null, phone = null, email = null, contact = null, active = true }) {
    const [ins] = await pool.query(
      `INSERT INTO SUPPLIERS (NAME, RUC, ADDRESS, PHONE, EMAIL, CONTACT_PERSON, ACTIVE)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, ruc, address, phone, email, contact, active ? 1 : 0]
    )
    const id = ins.insertId
    return { id, name, ruc, address, phone, email, contact, active: !!active }
  }
}
