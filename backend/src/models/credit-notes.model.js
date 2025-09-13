import { pool } from '../db.js'
import { InvoicesModel } from './invoices.model.js'
import { GuiasModel } from './guias.model.js'

export class CreditNotesModel {
  static async create({ tipo, idDoc, code, archivoPath, archivoName, motivo }) {
    const [r] = await pool.query(
      `INSERT INTO CREDIT_NOTES (TIPO, ID_DOC, CODIGO, ARCHIVO_PATH, ARCHIVO_NAME, MOTIVO)
       VALUES (?,?,?,?,?,?)`,
      [tipo, idDoc, code, archivoPath, archivoName, motivo || null]
    )
    // marcaremos ANULADA la doc origen
    if (tipo === 'FACTURA') await InvoicesModel.markCancelled(idDoc)
    if (tipo === 'GUIA')    await GuiasModel.markCancelled(idDoc)
    return { id: r.insertId }
  }
}
