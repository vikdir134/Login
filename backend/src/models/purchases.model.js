import { pool } from '../db.js'
import Purchase from './entities/Purchase.js'
import PurchaseItem from './entities/PurchaseItem.js'

export class PurchasesModel {
  static async list({ from, to, supplierId } = {}) {
    const where = []
    const params = []
    if (from) { where.push('DOCUMENT_DATE >= ?'); params.push(from) }
    if (to)   { where.push('DOCUMENT_DATE < ?');  params.push(to) }
    if (supplierId) { where.push('ID_SUPPLIER = ?'); params.push(supplierId) }

    const [rows] = await pool.query(
      `SELECT ID_PURCHASE AS id, ID_SUPPLIER AS supplierId, DOCUMENT_TYPE AS documentType,
              DOCUMENT_NUMBER AS documentNumber, DOCUMENT_DATE AS documentDate,
              TOTAL_NET AS totalNet, TAX_AMOUNT AS taxAmount, TOTAL_AMOUNT AS totalAmount,
              CURRENCY AS currency, NOTES AS notes, CREATED_BY AS createdBy, CREATED_AT AS createdAt
       FROM PURCHASES
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY DOCUMENT_DATE DESC, ID_PURCHASE DESC`,
      params
    )
    return rows.map(r => new Purchase(r))
  }

  static async get(id) {
    const [rows] = await pool.query(
      `SELECT ID_PURCHASE AS id, ID_SUPPLIER AS supplierId, DOCUMENT_TYPE AS documentType,
              DOCUMENT_NUMBER AS documentNumber, DOCUMENT_DATE AS documentDate,
              TOTAL_NET AS totalNet, TAX_AMOUNT AS taxAmount, TOTAL_AMOUNT AS totalAmount,
              CURRENCY AS currency, NOTES AS notes, CREATED_BY AS createdBy, CREATED_AT AS createdAt
       FROM PURCHASES WHERE ID_PURCHASE = ?`, [id]
    )
    if (!rows[0]) return null

    const [items] = await pool.query(
      `SELECT ID_PURCHASE_ITEM AS id, ID_PURCHASE AS purchaseId, ID_PRIMATER AS primaterId,
              QUANTITY AS quantity, UNIT_PRICE AS unitPrice, TOTAL_PRICE AS totalPrice, NOTES AS notes
       FROM PURCHASE_ITEMS WHERE ID_PURCHASE = ? ORDER BY ID_PURCHASE_ITEM ASC`, [id]
    )
    const purchase = new Purchase(rows[0])
    purchase.items = items.map(i => new PurchaseItem(i))
    return purchase
  }

  // Crea cabecera + items (y el trigger se encarga de stock)
  static async create({ header, items, createdBy }) {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      const [res] = await conn.query(
        `INSERT INTO PURCHASES
         (ID_SUPPLIER, DOCUMENT_TYPE, DOCUMENT_NUMBER, DOCUMENT_DATE,
          TOTAL_NET, TAX_AMOUNT, TOTAL_AMOUNT, CURRENCY, NOTES, CREATED_BY)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          header.supplierId, header.documentType, header.documentNumber, header.documentDate,
          header.totalNet, header.taxAmount, header.totalAmount, header.currency ?? 'PEN',
          header.notes ?? null, createdBy ?? null
        ]
      )
      const purchaseId = res.insertId

      for (const it of items) {
        const total = it.totalPrice ?? (Number(it.quantity) * Number(it.unitPrice))
        await conn.query(
          `INSERT INTO PURCHASE_ITEMS
           (ID_PURCHASE, ID_PRIMATER, QUANTITY, UNIT_PRICE, TOTAL_PRICE, NOTES)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [purchaseId, it.primaterId, it.quantity, it.unitPrice, total, it.notes ?? null]
        )
        // ⚠️ No insertamos stock aquí: lo hace el TRIGGER (después de cada item)
      }

      await conn.commit()
      const created = await this.get(purchaseId)
      return created
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }
}
