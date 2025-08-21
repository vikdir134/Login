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
// ===== MERMA =====
// GET /api/stock/merma?limit=30&offset=0&q=
stockRouter.get('/merma', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 100)
    const offset = Number(req.query.offset) || 0
    const q = (req.query.q || '').trim()

    // zona MERMA
    const [[z]] = await pool.query(`SELECT ID_SPACE id FROM SPACES WHERE TIPO='MERMA' LIMIT 1`)
    if (!z) return res.json({ items: [], total: 0 })
    const mermaId = z.id

    const params = [mermaId]
    let whereQ = ''
    if (q) {
      whereQ = ` AND (p.DESCRIPCION LIKE ? OR m.DESCRIPCION LIKE ? OR c.DESCRIPCION LIKE ?)`
      params.push(`%${q}%`, `%${q}%`, `%${q}%`)
    }

    // total (MP + PT)
    const [[{ total }]] = await pool.query(
      `
      SELECT COUNT(*) total FROM (
        SELECT pm.ID_PRIMATER AS K
        FROM STOCK_ZONE sz
        JOIN PRIMARY_MATERIALS pm ON pm.ID_PRIMATER = sz.ID_PRIMATER
        JOIN MATERIALS m ON m.ID_MATERIAL = pm.ID_MATERIAL
        LEFT JOIN COLORS c ON c.ID_COLOR = pm.ID_COLOR
        WHERE sz.ID_SPACE = ?
        ${whereQ}
        GROUP BY pm.ID_PRIMATER
        HAVING SUM(sz.PESO) > 0

        UNION ALL

        SELECT sfp.ID_PRODUCT AS K
        FROM STOCK_FINISHED_PRODUCT sfp
        JOIN PRODUCTS p ON p.ID_PRODUCT = sfp.ID_PRODUCT
        WHERE sfp.ID_SPACE = ?
        ${q ? ' AND p.DESCRIPCION LIKE ? ' : ''}
        GROUP BY sfp.ID_PRODUCT
        HAVING SUM(sfp.PESO) > 0
      ) t
      `,
      q ? [mermaId, mermaId, `%${q}%`] : [mermaId, mermaId]
    )

    // lista (MP)
    const [mp] = await pool.query(
      `
      SELECT
        'PRIMARY' AS type,
        pm.ID_PRIMATER  AS itemId,
        CONCAT(m.DESCRIPCION, IF(pm.DESCRIPCION IS NULL OR pm.DESCRIPCION='', '', CONCAT(' · ', pm.DESCRIPCION)),
               IF(c.DESCRIPCION IS NULL,'', CONCAT(' · ', c.DESCRIPCION))) AS itemName,
        ROUND(SUM(sz.PESO),2) AS stockKg,
        MAX(sz.FECHA) AS lastUpdate
      FROM STOCK_ZONE sz
      JOIN PRIMARY_MATERIALS pm ON pm.ID_PRIMATER = sz.ID_PRIMATER
      JOIN MATERIALS m ON m.ID_MATERIAL = pm.ID_MATERIAL
      LEFT JOIN COLORS c ON c.ID_COLOR = pm.ID_COLOR
      WHERE sz.ID_SPACE = ?
      ${whereQ}
      GROUP BY pm.ID_PRIMATER, m.DESCRIPCION, c.DESCRIPCION, pm.DESCRIPCION
      HAVING SUM(sz.PESO) > 0
      ORDER BY itemName ASC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    )

    // lista (PT)
    const [pt] = await pool.query(
      `
      SELECT
        'FINISHED' AS type,
        sfp.ID_PRODUCT AS itemId,
        p.DESCRIPCION  AS itemName,
        ROUND(SUM(sfp.PESO),2) AS stockKg,
        MAX(sfp.FECHA) AS lastUpdate
      FROM STOCK_FINISHED_PRODUCT sfp
      JOIN PRODUCTS p ON p.ID_PRODUCT = sfp.ID_PRODUCT
      WHERE sfp.ID_SPACE = ?
      ${q ? ' AND p.DESCRIPCION LIKE ? ' : ''}
      GROUP BY sfp.ID_PRODUCT, p.DESCRIPCION
      HAVING SUM(sfp.PESO) > 0
      ORDER BY itemName ASC
      LIMIT ? OFFSET ?
      `,
      q ? [mermaId, `%${q}%`, limit, offset] : [mermaId, limit, offset]
    )

    // mezcla simple (si prefieres, puedes paginar por separado)
    const items = [...mp, ...pt].slice(0, limit)
    res.json({ items, total: Number(total || 0) })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error listando merma' })
  }
})

// POST /api/stock/merma/add
// body: { sourceType:'PRIMARY'|'FINISHED', sourceZone:'RECEPCION'|'PRODUCCION'|'ALMACEN', itemId:number, qty:number, note? }
stockRouter.post('/merma/add', async (req, res) => {
  const sourceType = String(req.body?.sourceType || '').toUpperCase()
  const sourceZone = String(req.body?.sourceZone || '').toUpperCase()
  const itemId = Number(req.body?.itemId)
  const qty = Number(req.body?.qty)
  const note = req.body?.note || null

  if (!['PRIMARY','FINISHED'].includes(sourceType)) return res.status(400).json({ error: 'sourceType inválido' })
  if (!['RECEPCION','PRODUCCION','ALMACEN'].includes(sourceZone)) return res.status(400).json({ error: 'sourceZone inválido' })
  if (!(itemId > 0) || !(qty > 0)) return res.status(400).json({ error: 'Datos inválidos' })

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    // zona origen (por tipo)
    const [[zFrom]] = await conn.query(`SELECT ID_SPACE id FROM SPACES WHERE TIPO=? LIMIT 1`,
      [sourceZone])
    if (!zFrom) throw new Error('Zona origen no existe')

    // zona merma
    const [[zMerma]] = await conn.query(`SELECT ID_SPACE id FROM SPACES WHERE TIPO='MERMA' LIMIT 1`)
    if (!zMerma) throw new Error('No existe zona MERMA')
    const idFrom = zFrom.id, idMerma = zMerma.id

    if (sourceType === 'PRIMARY') {
      // validar saldo
      const [[r]] = await conn.query(
        `SELECT IFNULL(SUM(PESO),0) saldo
         FROM STOCK_ZONE WHERE ID_SPACE=? AND ID_PRIMATER=?`,
        [idFrom, itemId]
      )
      const saldo = Number(r?.saldo || 0)
      if (saldo + 1e-9 < qty) throw new Error('Stock insuficiente en zona origen')

      // salida origen
      await conn.query(
        `INSERT INTO STOCK_ZONE (ID_SPACE, ID_PRIMATER, PESO, FECHA, OBSERVACION)
         VALUES (?, ?, ?, NOW(), ?)`,
        [idFrom, itemId, -qty, note || 'Merma']
      )
      // entrada MERMA
      await conn.query(
        `INSERT INTO STOCK_ZONE (ID_SPACE, ID_PRIMATER, PESO, FECHA, OBSERVACION)
         VALUES (?, ?, ?, NOW(), ?)`,
        [idMerma, itemId, qty, note || `Merma desde ${sourceZone}`]
      )
    } else {
      // FINISHED
      const [[r]] = await conn.query(
        `SELECT IFNULL(SUM(PESO),0) saldo
         FROM STOCK_FINISHED_PRODUCT WHERE ID_SPACE=? AND ID_PRODUCT=?`,
        [idFrom, itemId]
      )
      const saldo = Number(r?.saldo || 0)
      if (saldo + 1e-9 < qty) throw new Error('Stock PT insuficiente en zona origen')

      // salida origen: insert fila negativa (o registrar movimiento, aquí simple)
      await conn.query(
        `INSERT INTO STOCK_FINISHED_PRODUCT (ID_PRODUCT, ID_SPACE, PESO, FECHA, PRESENTATION_KG, ID_PRESENTATION)
         VALUES (?, ?, ?, NOW(), NULL, NULL)`,
        [itemId, idFrom, -qty]
      )
      // entrada MERMA
      await conn.query(
        `INSERT INTO STOCK_FINISHED_PRODUCT (ID_PRODUCT, ID_SPACE, PESO, FECHA, PRESENTATION_KG, ID_PRESENTATION)
         VALUES (?, ?, ?, NOW(), NULL, NULL)`,
        [itemId, idMerma, qty]
      )
    }

    await conn.commit()
    res.json({ ok: true })
  } catch (e) {
    await conn.rollback()
    console.error(e)
    res.status(500).json({ error: e.message || 'Error agregando merma' })
  } finally {
    conn.release()
  }
})
