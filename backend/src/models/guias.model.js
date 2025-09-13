import { pool } from '../db.js'

export class GuiasModel {
  static async createWithFile({ code, archivoPath, archivoName }) {
    const [r] = await pool.query(
      `INSERT INTO GUIAS (CODIGO, ARCHIVO_PATH, ARCHIVO_NAME) VALUES (?,?,?)`,
      [code, archivoPath, archivoName]
    )
    return { id: r.insertId, code, archivoPath, archivoName, estado:'VIGENTE' }
  }

  static async markCancelled(id) {
    await pool.query(`UPDATE GUIAS SET ESTADO='ANULADA' WHERE ID_GUIA=?`, [id])
  }

  static async getById(id) {
    const [rows] = await pool.query(
      `SELECT ID_GUIA id, CODIGO code, ARCHIVO_PATH archivoPath, ARCHIVO_NAME archivoName, ESTADO estado FROM GUIAS WHERE ID_GUIA=?`,
      [id]
    )
    return rows[0] || null
  }
}
