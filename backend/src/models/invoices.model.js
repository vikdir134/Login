import { pool } from '../db.js'

export class InvoicesModel {
  static async createWithFile({ code, archivoPath, archivoName }) {
    const [r] = await pool.query(
      `INSERT INTO FACTURAS (CODIGO, ARCHIVO_PATH, ARCHIVO_NAME) VALUES (?,?,?)`,
      [code, archivoPath, archivoName]
    )
    return { id: r.insertId, code, archivoPath, archivoName, estado:'VIGENTE' }
  }

  static async markCancelled(id) {
    await pool.query(`UPDATE FACTURAS SET ESTADO='ANULADA' WHERE ID_FACTURA=?`, [id])
  }

  static async getById(id) {
    const [rows] = await pool.query(
      `SELECT ID_FACTURA id, CODIGO code, ARCHIVO_PATH archivoPath, ARCHIVO_NAME archivoName, ESTADO estado FROM FACTURAS WHERE ID_FACTURA=?`,
      [id]
    )
    return rows[0] || null
  }
}
