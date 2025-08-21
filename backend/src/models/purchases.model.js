// backend/src/models/purchases.model.js
import { pool } from '../db.js'

export class PurchasesModel {
  /**
   * Crea una compra con items y actualiza el stock en RECEPCION (Opción B: desde backend).
   * - Calcula TOTAL_NET a partir de items.
   * - IGV por defecto 18% (si no se envía taxAmount).
   * - Inserta cabecera + items.
   * - UPSERT a STOCK_ZONE: suma QUANTITY en la zona RECEPCION por cada item.
   */
  static async create({
    supplierId,
    documentType,
    documentNumber,
    documentDate,
    currency = 'PEN',
    taxAmount = null,
    notes = null,
    items = [],
    createdBy = null
  }) {
    // Validaciones de cabecera
    if (!supplierId || !documentType || !documentNumber || !documentDate) {
      const err = new Error('Faltan campos de cabecera (proveedor/tipo/número/fecha)')
      err.code = 'BAD_HEADER'
      throw err
    }
    if (!Array.isArray(items) || items.length === 0) {
      const err = new Error('Debe incluir al menos un ítem')
      err.code = 'NO_ITEMS'
      throw err
    }

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      // 1) Calcular totales
      let totalNet = 0
      for (const it of items) {
        if (!it.primaterId || !(Number(it.quantity) > 0)) {
          const e = new Error('Ítem inválido')
          e.code = 'BAD_ITEM'
          throw e
        }
        const q = Number(it.quantity)
        const up = Number(it.unitPrice || 0)
        totalNet += q * up
      }
      const tax = taxAmount != null ? Number(taxAmount) : Number((totalNet * 0.18).toFixed(2))
      const total = Number((totalNet + tax).toFixed(2))

      // 2) Insert cabecera
      const [resHead] = await conn.query(
        `INSERT INTO PURCHASES
         (ID_SUPPLIER, DOCUMENT_TYPE, DOCUMENT_NUMBER, DOCUMENT_DATE,
          TOTAL_NET, TAX_AMOUNT, TOTAL_AMOUNT, CURRENCY, NOTES, CREATED_BY)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          supplierId,
          documentType,
          documentNumber,
          documentDate,
          totalNet,
          tax,
          total,
          currency,
          notes,
          createdBy
        ]
      )
      const purchaseId = resHead.insertId

      // 3) Insert items
      for (const it of items) {
        const q = Number(it.quantity)
        const up = Number(it.unitPrice || 0)
        const tp = Number((q * up).toFixed(2))
        await conn.query(
          `INSERT INTO PURCHASE_ITEMS (ID_PURCHASE, ID_PRIMATER, QUANTITY, UNIT_PRICE, TOTAL_PRICE, NOTES)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [purchaseId, it.primaterId, q, up, tp, it.notes || null]
        )
      }

      // 4) Sumar stock en RECEPCION (UPSERT a STOCK_ZONE) — Opción B
      //    - Busca zona RECEPCION por TIPO o por NOMBRE
      const [[rowRecep]] = await conn.query(
        `SELECT ID_SPACE
           FROM SPACES
          WHERE TIPO = 'RECEPCION' OR NOMBRE = 'RECEPCION'
          LIMIT 1`
      )
      const recepcionId = rowRecep?.ID_SPACE || null

      if (recepcionId) {
        // Necesita índice único: uq_sz_space_primater (ID_SPACE, ID_PRIMATER)
        for (const it of items) {
          const q = Number(it.quantity)
          await conn.query(
            `INSERT INTO STOCK_ZONE (ID_SPACE, ID_PRIMATER, PESO, FECHA, OBSERVACION)
             VALUES (?, ?, ?, NOW(), ?)
             ON DUPLICATE KEY UPDATE
               PESO = PESO + VALUES(PESO),
               FECHA = NOW(),
               OBSERVACION = VALUES(OBSERVACION)`,
            [recepcionId, it.primaterId, q, `Ingreso por compra #${purchaseId}`]
          )
        }
      }
      // Si no existe RECEPCION, simplemente no actualizamos stock (puedes lanzar error si lo prefieres)

      await conn.commit()

      return {
        id: purchaseId,
        supplierId,
        documentType,
        documentNumber,
        documentDate,
        currency,
        totalNet,
        taxAmount: tax,
        totalAmount: total
      }
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }

  static async list({ supplierId, from, to, limit = 20, offset = 0 }) {
    const params = []
    let where = ' WHERE 1=1 '
    if (supplierId) { where += ' AND p.ID_SUPPLIER = ? '; params.push(Number(supplierId)) }
    if (from)       { where += ' AND p.DOCUMENT_DATE >= ? '; params.push(from) }
    if (to)         { where += ' AND p.DOCUMENT_DATE <= ? '; params.push(to) }

    const [rows] = await pool.query(
      `SELECT
         p.ID_PURCHASE      AS id,
         p.DOCUMENT_DATE    AS documentDate,
         p.DOCUMENT_TYPE    AS documentType,
         p.DOCUMENT_NUMBER  AS documentNumber,
         p.TOTAL_NET        AS totalNet,
         p.TAX_AMOUNT       AS taxAmount,
         p.TOTAL_AMOUNT     AS totalAmount,
         p.CURRENCY         AS currency,
         s.NAME             AS supplierName
       FROM PURCHASES p
       JOIN SUPPLIERS s ON s.ID_SUPPLIER = p.ID_SUPPLIER
       ${where}
       ORDER BY p.DOCUMENT_DATE DESC, p.ID_PURCHASE DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    )
    return rows
  }

  static async getById(id) {
    const [[header]] = await pool.query(
      `SELECT
         p.ID_PURCHASE      AS id,
         p.DOCUMENT_DATE    AS documentDate,
         p.DOCUMENT_TYPE    AS documentType,
         p.DOCUMENT_NUMBER  AS documentNumber,
         p.TOTAL_NET        AS totalNet,
         p.TAX_AMOUNT       AS taxAmount,
         p.TOTAL_AMOUNT     AS totalAmount,
         p.CURRENCY         AS currency,
         p.NOTES            AS notes,
         s.NAME             AS supplierName
       FROM PURCHASES p
       JOIN SUPPLIERS s ON s.ID_SUPPLIER = p.ID_SUPPLIER
       WHERE p.ID_PURCHASE = ?`,
      [id]
    )
    if (!header) return null

    const [items] = await pool.query(
      `SELECT
         i.ID_PURCHASE_ITEM AS id,
         i.ID_PRIMATER      AS primaterId,
         i.QUANTITY         AS quantity,
         i.UNIT_PRICE       AS unitPrice,
         i.TOTAL_PRICE      AS totalPrice,
         i.NOTES            AS notes,
         m.DESCRIPCION      AS MATERIAL,
         c.DESCRIPCION      AS COLOR
       FROM PURCHASE_ITEMS i
       JOIN PRIMARY_MATERIALS pm ON pm.ID_PRIMATER = i.ID_PRIMATER
       JOIN MATERIALS m ON m.ID_MATERIAL = pm.ID_MATERIAL
       LEFT JOIN COLORS c ON c.ID_COLOR = pm.ID_COLOR
       WHERE i.ID_PURCHASE = ?
       ORDER BY i.ID_PURCHASE_ITEM ASC`,
      [id]
    )

    return { header, items }
  }
}
