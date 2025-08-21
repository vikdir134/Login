// backend/src/routes/merma.routes.js
import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

// POST /api/stock/merma
// body: { originZoneId, type:'MP'|'PT', primaterId?, productId?, presentationId?, qty, note? }
router.post('/stock/merma', async (req, res) => {
  const originZoneId   = Number(req.body?.originZoneId)
  const type           = String(req.body?.type || '').toUpperCase()
  const primaterId     = req.body?.primaterId ? Number(req.body.primaterId) : null
  const productId      = req.body?.productId ? Number(req.body.productId) : null
  const presentationId = req.body?.presentationId ? Number(req.body.presentationId) : null
  const qty            = Number(req.body?.qty || 0)
  const note           = req.body?.note || null

  if (!originZoneId || !['MP','PT'].includes(type) || !(qty > 0)) {
    return res.status(400).json({ error: 'Datos inválidos' })
  }
  if (type === 'MP' && !primaterId) return res.status(400).json({ error: 'Falta primaterId' })
  if (type === 'PT' && !productId)  return res.status(400).json({ error: 'Falta productId' })

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    if (type === 'MP') {
      // verifica saldo y descuenta (negativo)
      const [[r]] = await conn.query(
        `SELECT IFNULL(SUM(PESO),0) saldo
         FROM STOCK_ZONE
         WHERE ID_SPACE=? AND ID_PRIMATER=?`,
         [originZoneId, primaterId]
      )
      const saldo = Number(r?.saldo || 0)
      if (saldo + 1e-9 < qty) throw new Error('Stock insuficiente en zona')

      await conn.query(
        `INSERT INTO STOCK_ZONE (ID_SPACE, ID_PRIMATER, PESO, FECHA, OBSERVACION)
         VALUES (?, ?, ?, NOW(), ?)`,
        [originZoneId, primaterId, -qty, note || 'Merma']
      )
    } else {
      // PT: descuenta de STOCK_FINISHED_PRODUCT
      const [[r]] = await conn.query(
        `SELECT IFNULL(SUM(PESO),0) saldo
         FROM STOCK_FINISHED_PRODUCT
         WHERE ID_SPACE=? AND ID_PRODUCT=?`,
         [originZoneId, productId]
      )
      const saldo = Number(r?.saldo || 0)
      if (saldo + 1e-9 < qty) throw new Error('Stock PT insuficiente en zona')

      await conn.query(
        `INSERT INTO STOCK_FINISHED_PRODUCT (ID_PRODUCT, ID_SPACE, PESO, FECHA, PRESENTATION_KG, ID_PRESENTATION)
         VALUES (?, ?, ?, NOW(), NULL, ?)`,
        [productId, originZoneId, -qty, presentationId || null]
      )
    }

    await conn.query(
      `INSERT INTO STOCK_SCRAP
        (TYPE_ITEM, ORIGIN_ZONE, ID_PRIMATER, ID_PRODUCT, ID_PRESENTATION, QTY_KG, NOTE)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [type, originZoneId, primaterId, productId, presentationId, qty, note]
    )

    await conn.commit()
    res.status(201).json({ ok: true })
  } catch (e) {
    await conn.rollback()
    res.status(400).json({ error: e.message })
  } finally {
    conn.release()
  }
})

// GET /api/stock/merma?limit=10&offset=0
router.get('/stock/merma', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 100)
    const offset = Number(req.query.offset) || 0

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) total FROM STOCK_SCRAP`)
    const [rows] = await pool.query(
      `
       SELECT
         s.ID_SCRAP id,
         s.FECHA,
         sp.NOMBRE   AS zoneName,
         s.TYPE_ITEM AS type,
         s.QTY_KG    AS qtyKg,
         s.NOTE      AS note,
         pm.DESCRIPCION AS mpDesc,
         p.DESCRIPCION  AS prodDesc
       FROM STOCK_SCRAP s
       JOIN SPACES sp ON sp.ID_SPACE = s.ORIGIN_ZONE
       LEFT JOIN PRIMARY_MATERIALS pm ON pm.ID_PRIMATER = s.ID_PRIMATER
       LEFT JOIN PRODUCTS p ON p.ID_PRODUCT = s.ID_PRODUCT
       ORDER BY s.FECHA DESC, s.ID_SCRAP DESC
       LIMIT ? OFFSET ?
      `,
      [limit, offset]
    )

    res.json({ items: rows, total })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error listando merma' })
  }
})

export default router
