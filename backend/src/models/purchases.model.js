import { pool } from '../db.js'

export class PurchasesModel {
  static async list({ supplierId = null, from = null, to = null, limit = 50, offset = 0 }) {
    const params = []
    let where = 'WHERE 1=1'
    if (supplierId) { where += ' AND p.ID_SUPPLIER = ?'; params.push(supplierId) }
    if (from)       { where += ' AND p.DOCUMENT_DATE >= ?'; params.push(from) }
    if (to)         { where += ' AND p.DOCUMENT_DATE < DATE_ADD(?, INTERVAL 1 DAY)'; params.push(to) }

    const [rows] = await pool.query(
      `SELECT p.ID_PURCHASE AS id, p.ID_SUPPLIER AS supplierId, s.NAME AS supplierName,
              p.DOCUMENT_TYPE AS documentType, p.DOCUMENT_NUMBER AS documentNumber,
              p.DOCUMENT_DATE AS documentDate,
              p.TOTAL_NET AS totalNet, p.TAX_AMOUNT AS taxAmount, p.TOTAL_AMOUNT AS totalAmount,
              p.CURRENCY, p.NOTES, p.CREATED_AT
       FROM PURCHASES p
       JOIN SUPPLIERS s ON s.ID_SUPPLIER = p.ID_SUPPLIER
       ${where}
       ORDER BY p.DOCUMENT_DATE DESC, p.ID_PURCHASE DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    )
    return rows
  }

  static async create({ supplierId, documentType, documentNumber, documentDate, currency = 'PEN', notes = null, createdBy = null, items }) {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      // Cabecera con totales en 0 (calculamos al final)
      const [resHead] = await conn.query(
        `INSERT INTO PURCHASES
         (ID_SUPPLIER, DOCUMENT_TYPE, DOCUMENT_NUMBER, DOCUMENT_DATE,
          TOTAL_NET, TAX_AMOUNT, TOTAL_AMOUNT, CURRENCY, NOTES, CREATED_BY)
         VALUES (?, ?, ?, ?, 0, 0, 0, ?, ?, ?)`,
        [supplierId, documentType, documentNumber, documentDate, currency, notes, createdBy]
      )
      const purchaseId = resHead.insertId

      let totalNet = 0
      for (const it of items) {
        const lineTotal = Number(it.quantity) * Number(it.unitPrice)
        totalNet += lineTotal
        await conn.query(
          `INSERT INTO PURCHASE_ITEMS
           (ID_PURCHASE, ID_PRIMATER, QUANTITY, UNIT_PRICE, TOTAL_PRICE, NOTES)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [purchaseId, it.primaryMaterialId, it.quantity, it.unitPrice, lineTotal, it.notes ?? null]
        )
      }

      // Impuesto simple: IGV 18% (ajusta si manejas otra lógica)
      const tax = Math.round(totalNet * 0.18 * 100) / 100
      const total = totalNet + tax

      await conn.query(
        `UPDATE PURCHASES
         SET TOTAL_NET = ?, TAX_AMOUNT = ?, TOTAL_AMOUNT = ?
         WHERE ID_PURCHASE = ?`,
        [totalNet, tax, total, purchaseId]
      )

      await conn.commit()

      // DEVOLVER CABECERA + ITEMS
      const [[head]] = await pool.query(
        `SELECT p.ID_PURCHASE AS id, p.ID_SUPPLIER AS supplierId, s.NAME AS supplierName,
                p.DOCUMENT_TYPE AS documentType, p.DOCUMENT_NUMBER AS documentNumber,
                p.DOCUMENT_DATE AS documentDate, p.TOTAL_NET AS totalNet, p.TAX_AMOUNT AS taxAmount,
                p.TOTAL_AMOUNT AS totalAmount, p.CURRENCY, p.NOTES, p.CREATED_AT
         FROM PURCHASES p
         JOIN SUPPLIERS s ON s.ID_SUPPLIER = p.ID_SUPPLIER
         WHERE p.ID_PURCHASE = ?`,
        [purchaseId]
      )
      const [lines] = await pool.query(
        `SELECT ID_PURCHASE_ITEM AS id, ID_PRIMATER AS primaryMaterialId, QUANTITY AS quantity,
                UNIT_PRICE AS unitPrice, TOTAL_PRICE AS totalPrice, NOTES
         FROM PURCHASE_ITEMS WHERE ID_PURCHASE = ?`,
        [purchaseId]
      )

      return { ...head, items: lines }
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }
}
