// backend/src/routes/stock.routes.js
import { Router } from 'express'
import { pool } from '../db.js'
import { getFirstZoneByTipo } from '../lib/zones.js'
export const stockRouter = Router()


// ==== LISTAR MP POR ZONA (TIPO) ====
// GET /api/stock/primary?zone=RECEPCION|PRODUCCION&limit=30&offset=0&q=texto
stockRouter.get('/primary', async (req, res) => {
  try {
    const zoneTipo = String(req.query.zone || '').toUpperCase()
    if (!['RECEPCION','PRODUCCION'].includes(zoneTipo)) {
      return res.status(400).json({ error: 'zone debe ser RECEPCION o PRODUCCION' })
    }
    const limit = Math.min(Number(req.query.limit) || 30, 100)
    const offset = Number(req.query.offset) || 0
    const q = (req.query.q || '').trim()

    const params = []
    let whereQ = ''
    if (q) {
      whereQ = ` AND (pm.DESCRIPCION LIKE ? OR m.DESCRIPCION LIKE ? OR c.DESCRIPCION LIKE ?) `
      params.push(`%${q}%`, `%${q}%`, `%${q}%`)
    }

    // total para paginación
    const [[{ total }]] = await pool.query(
      `
      SELECT COUNT(*) AS total FROM (
        SELECT pm.ID_PRIMATER
        FROM STOCK_ZONE sz
        JOIN SPACES s   ON s.ID_SPACE = sz.ID_SPACE AND s.TIPO=?
        JOIN PRIMARY_MATERIALS pm ON pm.ID_PRIMATER = sz.ID_PRIMATER
        JOIN MATERIALS m ON m.ID_MATERIAL = pm.ID_MATERIAL
        LEFT JOIN COLORS c ON c.ID_COLOR = pm.ID_COLOR
        ${whereQ}
        GROUP BY pm.ID_PRIMATER
        HAVING SUM(sz.PESO) > 0
      ) t
      `,
      [zoneTipo, ...params]
    )

    // lista con DENIER y última actualización
    const [rows] = await pool.query(
      `
      SELECT
        pm.ID_PRIMATER           AS primaterId,
        m.DESCRIPCION            AS material,
        c.DESCRIPCION            AS color,
        pm.DESCRIPCION           AS descripcion,
        pm.DENIER                AS denier,
        ROUND(SUM(sz.PESO), 2)   AS stockKg,
        MAX(sz.FECHA)            AS lastUpdate
      FROM STOCK_ZONE sz
      JOIN SPACES s   ON s.ID_SPACE = sz.ID_SPACE AND s.TIPO=?
      JOIN PRIMARY_MATERIALS pm ON pm.ID_PRIMATER = sz.ID_PRIMATER
      JOIN MATERIALS m ON m.ID_MATERIAL = pm.ID_MATERIAL
      LEFT JOIN COLORS c ON c.ID_COLOR = pm.ID_COLOR
      ${whereQ}
      GROUP BY pm.ID_PRIMATER, m.DESCRIPCION, c.DESCRIPCION, pm.DESCRIPCION, pm.DENIER
      HAVING SUM(sz.PESO) > 0
      ORDER BY material ASC, color ASC
      LIMIT ? OFFSET ?
      `,
      [zoneTipo, ...params, limit, offset]
    )

    res.json({ items: rows, total })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error listando stock MP' })
  }
})


// Listar stock de Producto Terminado en ALMACEN, agregado por producto+presentación
stockRouter.get('/finished', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 100)
    const offset = Number(req.query.offset) || 0
    const q = (req.query.q || '').trim()

    const params = []
    let whereQ = ''
    if (q) {
      whereQ = ` AND p.DESCRIPCION LIKE ? `
      params.push(`%${q}%`)
    }

    // total grupos
    const [[{ total }]] = await pool.query(
      `
      SELECT COUNT(*) AS total FROM (
        SELECT
          sfp.ID_PRODUCT,
          IFNULL(sfp.ID_PRESENTATION, 0) AS pid
        FROM STOCK_FINISHED_PRODUCT sfp
        JOIN SPACES s ON s.ID_SPACE = sfp.ID_SPACE AND s.TIPO='ALMACEN'
        JOIN PRODUCTS p ON p.ID_PRODUCT = sfp.ID_PRODUCT
        WHERE 1=1
        ${whereQ}
        GROUP BY sfp.ID_PRODUCT, IFNULL(sfp.ID_PRESENTATION, 0), IFNULL(sfp.PRESENTATION_KG, 0)
        HAVING SUM(sfp.PESO) > 0
      ) t
      `,
      params
    )

    // items
    const [rows] = await pool.query(
      `
      SELECT
        sfp.ID_PRODUCT                         AS productId,
        p.DESCRIPCION                          AS productName,
        IFNULL(sfp.ID_PRESENTATION, NULL)      AS presentationId,
        -- si existe catálogo, toma su PESO_KG; sino usa la columna guardada en stock
        COALESCE(pp.PESO_KG, MAX(sfp.PRESENTATION_KG)) AS presentationKg,
        ROUND(SUM(sfp.PESO), 2)                AS stockKg
      FROM STOCK_FINISHED_PRODUCT sfp
      JOIN SPACES s ON s.ID_SPACE = sfp.ID_SPACE AND s.TIPO='ALMACEN'
      JOIN PRODUCTS p ON p.ID_PRODUCT = sfp.ID_PRODUCT
      LEFT JOIN PRODUCT_PRESENTATIONS pp
        ON pp.ID_PRESENTATION = sfp.ID_PRESENTATION
      WHERE 1=1
      ${whereQ}
      GROUP BY sfp.ID_PRODUCT, p.DESCRIPCION, IFNULL(sfp.ID_PRESENTATION, NULL), COALESCE(pp.PESO_KG, MAX(sfp.PRESENTATION_KG))
      HAVING SUM(sfp.PESO) > 0
      ORDER BY p.DESCRIPCION ASC, presentationKg ASC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    )

    res.json({ items: rows, total: Number(total || 0) })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error listando stock de PT' })
  }
})


// ==== MOVER MP ENTRE ZONAS (por TIPO) ====
// POST /api/stock/primary/move
// body: { from:'RECEPCION'|'PRODUCCION', to:'RECEPCION'|'PRODUCCION', primaterId, qty, note? }
stockRouter.post('/primary/move', async (req, res) => {
  const from = String(req.body?.from || '').toUpperCase()
  const to   = String(req.body?.to || '').toUpperCase()
  const primaterId = Number(req.body?.primaterId)
  const qty  = Number(req.body?.qty || 0)
  const note = req.body?.note || null

  if (!['RECEPCION','PRODUCCION'].includes(from) || !['RECEPCION','PRODUCCION'].includes(to)) {
    return res.status(400).json({ error: 'from/to deben ser RECEPCION o PRODUCCION' })
  }
  if (from === to) return res.status(400).json({ error: 'Zonas iguales' })
  if (!primaterId || !(qty > 0)) return res.status(400).json({ error: 'Datos inválidos' })

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const fromZone = await getFirstZoneByTipo(conn, from)
    const toZone   = await getFirstZoneByTipo(conn, to)
    if (!fromZone || !toZone) throw new Error('Zonas no configuradas')

    const [[r]] = await conn.query(
      `SELECT IFNULL(SUM(PESO),0) saldo
       FROM STOCK_ZONE
       WHERE ID_SPACE=? AND ID_PRIMATER=?`,
       [fromZone.id, primaterId]
    )
    const saldo = Number(r?.saldo || 0)
    if (saldo + 1e-9 < qty) throw new Error('Stock insuficiente en zona origen')

    // salida origen (negativo)
    await conn.query(
      `INSERT INTO STOCK_ZONE (ID_SPACE, ID_PRIMATER, PESO, FECHA, OBSERVACION)
       VALUES (?, ?, ?, NOW(), ?)`,
      [fromZone.id, primaterId, -qty, note || `Mover a ${toZone.name}`]
    )
    // entrada destino (positivo)
    await conn.query(
      `INSERT INTO STOCK_ZONE (ID_SPACE, ID_PRIMATER, PESO, FECHA, OBSERVACION)
       VALUES (?, ?, ?, NOW(), ?)`,
      [toZone.id, primaterId, qty, note || `Desde ${fromZone.name}`]
    )

    await conn.commit()
    res.json({ ok: true })
  } catch (e) {
    await conn.rollback()
    res.status(400).json({ error: e.message })
  } finally {
    conn.release()
  }
})
