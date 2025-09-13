import { pool } from '../db.js'

export class DocsModel {
  static async createInvoice({ customerId, code, archivoPath, orderDeliveryId }) {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const [res] = await conn.query(
        `INSERT INTO FACTURAS (CODIGO, ARCHIVO_PATH, ESTADO) VALUES (?, ?, 'ACTIVA')`,
        [code, archivoPath || null]
      )
      const facturaId = res.insertId

      // si se quiere linkear de frente a la entrega
      if (orderDeliveryId) {
        await conn.query(
          `UPDATE ORDER_DELIVERY SET ID_FACTURA = ? WHERE ID_ORDER_DELIVERY = ?`,
          [facturaId, orderDeliveryId]
        )
      }

      await conn.commit()
      return { id: facturaId, code, archivoPath, estado: 'ACTIVA' }
    } catch (e) {
      await conn.rollback(); throw e
    } finally { conn.release() }
  }

  static async createGuide({ code, archivoPath, orderDeliveryId }) {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const [res] = await conn.query(
        `INSERT INTO GUIAS (CODIGO, ARCHIVO_PATH, ESTADO) VALUES (?, ?, 'ACTIVA')`,
        [code, archivoPath || null]
      )
      const guiaId = res.insertId

      if (orderDeliveryId) {
        await conn.query(
          `UPDATE ORDER_DELIVERY SET ID_GUIA = ? WHERE ID_ORDER_DELIVERY = ?`,
          [guiaId, orderDeliveryId]
        )
      }

      await conn.commit()
      return { id: guiaId, code, archivoPath, estado: 'ACTIVA' }
    } catch (e) {
      await conn.rollback(); throw e
    } finally { conn.release() }
  }

  static async createCreditNote({ type, code, reason, archivoPath, invoiceId, guideId }) {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      if (type === 'FACTURA') {
        if (!invoiceId) throw new Error('invoiceId requerido')
        const [res] = await conn.query(
          `INSERT INTO NOTAS_CREDITO (TIPO, ID_FACTURA, CODIGO, MOTIVO, ARCHIVO_PATH)
           VALUES ('FACTURA', ?, ?, ?, ?)`,
          [invoiceId, code, reason || null, archivoPath || null]
        )
        const idNc = res.insertId
        await conn.query(
          `UPDATE FACTURAS SET ESTADO = 'ANULADA', ID_NOTA_CREDITO = ? WHERE ID_FACTURA = ?`,
          [idNc, invoiceId]
        )
        await conn.commit()
        return { id: idNc, type, code, archivoPath }
      } else {
        if (!guideId) throw new Error('guideId requerido')
        const [res] = await conn.query(
          `INSERT INTO NOTAS_CREDITO (TIPO, ID_GUIA, CODIGO, MOTIVO, ARCHIVO_PATH)
           VALUES ('GUIA', ?, ?, ?, ?)`,
          [guideId, code, reason || null, archivoPath || null]
        )
        const idNc = res.insertId
        await conn.query(
          `UPDATE GUIAS SET ESTADO = 'ANULADA' WHERE ID_GUIA = ?`,
          [guideId]
        )
        await conn.commit()
        return { id: idNc, type, code, archivoPath }
      }
    } catch (e) {
      await conn.rollback(); throw e
    } finally { conn.release() }
  }
}
