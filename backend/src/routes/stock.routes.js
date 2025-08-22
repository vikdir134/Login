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
/* GET /api/stock/finished/summary?q=&limit=&offset=
stockRouter.get('/finished/summary', async (req, res) => {
  try {
    const limit  = Math.min(Number(req.query.limit) || 30, 100)
    const offset = Number(req.query.offset) || 0
    const qRaw   = (req.query.q || '').trim()
    const params = []

    let whereQ = ``
    if (qRaw) {
      whereQ = ` AND p.DESCRIPCION LIKE ?`
      params.push(`%${qRaw}%`)
    }

    // total productos con stock > 0
    const [[{ total }]] = await pool.query(
      `
      SELECT COUNT(*) total FROM (
        SELECT sfp.ID_PRODUCT
        FROM STOCK_FINISHED_PRODUCT sfp
        JOIN SPACES s ON s.ID_SPACE = sfp.ID_SPACE AND s.TIPO='ALMACEN'
        JOIN PRODUCTS p ON p.ID_PRODUCT = sfp.ID_PRODUCT
        WHERE 1=1
        ${whereQ}
        GROUP BY sfp.ID_PRODUCT
        HAVING SUM(sfp.PESO) > 0
      ) t
      `,
      params
    )

    // filas
    const [rows] = await pool.query(
      `
      SELECT
        sfp.ID_PRODUCT               AS productId,
        p.DESCRIPCION                AS productName,
        ROUND(SUM(sfp.PESO), 2)      AS stockKg
      FROM STOCK_FINISHED_PRODUCT sfp
      JOIN SPACES s ON s.ID_SPACE = sfp.ID_SPACE AND s.TIPO='ALMACEN'
      JOIN PRODUCTS p ON p.ID_PRODUCT = sfp.ID_PRODUCT
      WHERE 1=1
      ${whereQ}
      GROUP BY sfp.ID_PRODUCT, p.DESCRIPCION
      HAVING SUM(sfp.PESO) > 0
      ORDER BY p.DESCRIPCION ASC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    )

    res.json({ items: rows, total: Number(total || 0) })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error listando PT (resumen)' })
  }
})*/
// GET /api/stock/finished/by-product?productId=123
stockRouter.get('/finished/by-product', async (req, res) => {
  try {
    const productId = Number(req.query.productId)
    if (!productId) return res.status(400).json({ error: 'productId requerido' })

    const [rows] = await pool.query(
      `
      SELECT
        sfp.ID_PRODUCT                         AS productId,
        p.DESCRIPCION                          AS productName,
        IFNULL(sfp.ID_PRESENTATION, NULL)      AS presentationId,
        -- compliant con ONLY_FULL_GROUP_BY: usa agregados
        COALESCE(MAX(pp.PESO_KG), MAX(sfp.PRESENTATION_KG)) AS presentationKg,
        ROUND(SUM(sfp.PESO), 2)                AS stockKg
      FROM STOCK_FINISHED_PRODUCT sfp
      JOIN SPACES s ON s.ID_SPACE = sfp.ID_SPACE AND s.TIPO='ALMACEN'
      JOIN PRODUCTS p ON p.ID_PRODUCT = sfp.ID_PRODUCT
      LEFT JOIN PRODUCT_PRESENTATIONS pp
        ON pp.ID_PRESENTATION = sfp.ID_PRESENTATION
      WHERE sfp.ID_PRODUCT = ?
      GROUP BY
        sfp.ID_PRODUCT,
        p.DESCRIPCION,
        IFNULL(sfp.ID_PRESENTATION, NULL)
      HAVING SUM(sfp.PESO) > 0
      ORDER BY presentationKg ASC
      `,
      [productId]
    )

    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error listando PT por presentaciones' })
  }
})


// Listar stock de Producto Terminado en ALMACEN, agregado por producto+presentación
// === LISTAR STOCK DE PT EN ALMACEN ===
// === LISTAR STOCK DE PT EN ALMACEN ===
stockRouter.get('/finished', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 100)
    const offset = Number(req.query.offset) || 0
    const q = (req.query.q || '').trim()

    const paramsQ = []
    let whereQ = ''
    if (q) { whereQ = ` AND p.DESCRIPCION LIKE ? `; paramsQ.push(`%${q}%`) }

    // total grupos
    const [[{ total }]] = await pool.query(
      `
      SELECT COUNT(*) AS total FROM (
        SELECT sfp.ID_PRODUCT, IFNULL(sfp.ID_PRESENTATION, 0) AS pid
        FROM STOCK_FINISHED_PRODUCT sfp
        JOIN SPACES s ON s.ID_SPACE = sfp.ID_SPACE AND s.TIPO='ALMACEN'
        JOIN PRODUCTS p ON p.ID_PRODUCT = sfp.ID_PRODUCT
        WHERE 1=1
        ${whereQ}
        GROUP BY sfp.ID_PRODUCT, IFNULL(sfp.ID_PRESENTATION, 0)
        HAVING SUM(sfp.PESO) > 0
      ) t
      `,
      paramsQ
    )

    // items
    const [rows] = await pool.query(
      `
      SELECT
        sfp.ID_PRODUCT                    AS productId,
        p.DESCRIPCION                     AS productName,
        IFNULL(sfp.ID_PRESENTATION, NULL) AS presentationId,
        COALESCE(pp.PESO_KG, MAX(sfp.PRESENTATION_KG)) AS presentationKg,
        ROUND(SUM(sfp.PESO), 2)          AS stockKg
      FROM STOCK_FINISHED_PRODUCT sfp
      JOIN SPACES s ON s.ID_SPACE = sfp.ID_SPACE AND s.TIPO='ALMACEN'
      JOIN PRODUCTS p ON p.ID_PRODUCT = sfp.ID_PRODUCT
      LEFT JOIN PRODUCT_PRESENTATIONS pp
        ON pp.ID_PRESENTATION = sfp.ID_PRESENTATION
      WHERE 1=1
      ${whereQ}
      GROUP BY sfp.ID_PRODUCT, p.DESCRIPCION, IFNULL(sfp.ID_PRESENTATION, NULL)
      HAVING SUM(sfp.PESO) > 0
      ORDER BY p.DESCRIPCION ASC, presentationKg ASC
      LIMIT ? OFFSET ?
      `,
      [...paramsQ, limit, offset]
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
// === LISTAR MERMA (MP+PT en zona MERMA) ===
// ==== LISTAR MERMA (MP + PT) CON TYPE E IDS CLAROS ====
// GET /api/stock/merma?q=&limit=30&offset=0
stockRouter.get('/merma', async (req, res) => {
  try {
    const limit  = Math.min(Number(req.query.limit) || 30, 100)
    const offset = Number(req.query.offset) || 0
    const qRaw   = (req.query.q || '').trim()
    const qLike  = `%${qRaw}%`

    // busca 1ra zona MERMA
    const [[mermaZone]] = await pool.query(
      `SELECT ID_SPACE id FROM SPACES WHERE TIPO='MERMA' ORDER BY ID_SPACE LIMIT 1`
    )
    if (!mermaZone) return res.json({ items: [], total: 0 })

    // --- TOTAL ---
    const paramsTot = []
    let whereMp = `WHERE sz.ID_SPACE = ?`
    paramsTot.push(mermaZone.id)
    let wherePt = `WHERE sfp.ID_SPACE = ?`
    const paramsTotPt = [mermaZone.id]

    if (qRaw) {
      whereMp += ` AND (m.DESCRIPCION LIKE ? OR IFNULL(c.DESCRIPCION,'') LIKE ? OR IFNULL(pm.DESCRIPCION,'') LIKE ?)`
      paramsTot.push(qLike, qLike, qLike)
      wherePt += ` AND p.DESCRIPCION LIKE ?`
      paramsTotPt.push(qLike)
    }

    const [[tot]] = await pool.query(
      `
      SELECT COUNT(*) total FROM (
        SELECT pm.ID_PRIMATER AS K
        FROM STOCK_ZONE sz
        JOIN PRIMARY_MATERIALS pm ON pm.ID_PRIMATER = sz.ID_PRIMATER
        JOIN MATERIALS m ON m.ID_MATERIAL = pm.ID_MATERIAL
        LEFT JOIN COLORS c ON c.ID_COLOR = pm.ID_COLOR
        ${whereMp}
        GROUP BY pm.ID_PRIMATER
        HAVING SUM(sz.PESO) > 0

        UNION ALL

        SELECT sfp.ID_PRODUCT AS K
        FROM STOCK_FINISHED_PRODUCT sfp
        JOIN PRODUCTS p ON p.ID_PRODUCT = sfp.ID_PRODUCT
        ${wherePt}
        GROUP BY sfp.ID_PRODUCT
        HAVING SUM(sfp.PESO) > 0
      ) t
      `,
      [...paramsTot, ...paramsTotPt]
    )

    // --- ITEMS ---
    const params = []
    let whereMp2 = `WHERE sz.ID_SPACE = ?`
    params.push(mermaZone.id)
    let wherePt2 = `WHERE sfp.ID_SPACE = ?`
    const paramsPt2 = [mermaZone.id]

    if (qRaw) {
      whereMp2 += ` AND (m.DESCRIPCION LIKE ? OR IFNULL(c.DESCRIPCION,'') LIKE ? OR IFNULL(pm.DESCRIPCION,'') LIKE ?)`
      params.push(qLike, qLike, qLike)
      wherePt2 += ` AND p.DESCRIPCION LIKE ?`
      paramsPt2.push(qLike)
    }

    const [rows] = await pool.query(
      `
      SELECT * FROM (
        -- MP en merma
        SELECT
          'PRIMARY' AS type,
          pm.ID_PRIMATER AS primaterId,
          NULL AS productId,
          CONCAT(m.DESCRIPCION,
                 CASE WHEN c.DESCRIPCION IS NOT NULL THEN CONCAT(' / ', c.DESCRIPCION) ELSE '' END,
                 CASE WHEN pm.DESCRIPCION IS NOT NULL THEN CONCAT(' · ', pm.DESCRIPCION) ELSE '' END
          ) AS name,
          ROUND(SUM(sz.PESO),2) AS stockKg,
          MAX(sz.FECHA) AS lastUpdate
        FROM STOCK_ZONE sz
        JOIN PRIMARY_MATERIALS pm ON pm.ID_PRIMATER = sz.ID_PRIMATER
        JOIN MATERIALS m ON m.ID_MATERIAL = pm.ID_MATERIAL
        LEFT JOIN COLORS c ON c.ID_COLOR = pm.ID_COLOR
        ${whereMp2}
        GROUP BY pm.ID_PRIMATER, m.DESCRIPCION, c.DESCRIPCION, pm.DESCRIPCION
        HAVING SUM(sz.PESO) > 0

        UNION ALL

        -- PT en merma
        SELECT
          'FINISHED' AS type,
          NULL AS primaterId,
          sfp.ID_PRODUCT AS productId,
          p.DESCRIPCION AS name,
          ROUND(SUM(sfp.PESO),2) AS stockKg,
          MAX(sfp.FECHA) AS lastUpdate
        FROM STOCK_FINISHED_PRODUCT sfp
        JOIN PRODUCTS p ON p.ID_PRODUCT = sfp.ID_PRODUCT
        ${wherePt2}
        GROUP BY sfp.ID_PRODUCT, p.DESCRIPCION
        HAVING SUM(sfp.PESO) > 0
      ) t
      ORDER BY name ASC
      LIMIT ? OFFSET ?
      `,
      [...params, ...paramsPt2, limit, offset]
    )

    res.json({ items: rows, total: Number(tot.total || 0) })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error listando merma' })
  }
})



// POST /api/stock/merma/add
// body: { sourceType:'PRIMARY'|'FINISHED', sourceZone:'RECEPCION'|'PRODUCCION'|'ALMACEN', itemId:number, qty:number, note? }
// === AGREGAR MERMA ===
// body: { source:'PRIMARY'|'FINISHED', from:'RECEPCION'|'PRODUCCION'|'ALMACEN', itemId:number, qty:number, note?:string }
stockRouter.post('/merma/add', async (req, res) => {
  const source = String(req.body?.source || '').toUpperCase() // PRIMARY|FINISHED
  const from   = String(req.body?.from || '').toUpperCase()   // RECEPCION|PRODUCCION|ALMACEN
  const itemId = Number(req.body?.itemId)
  const qty    = Number(req.body?.qty)
  const note   = req.body?.note || null

  if (!['PRIMARY','FINISHED'].includes(source)) return res.status(400).json({ error: 'source inválido' })
  if (!['RECEPCION','PRODUCCION','ALMACEN'].includes(from)) return res.status(400).json({ error: 'from inválido' })
  if (!itemId || !(qty > 0)) return res.status(400).json({ error: 'Datos inválidos' })

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // id zona origen por tipo
    const [[fromZ]] = await conn.query('SELECT ID_SPACE id FROM SPACES WHERE TIPO=? LIMIT 1', [from])
    if (!fromZ) throw new Error('Zona origen no existe')

    // id zona merma
    const [[mermaZ]] = await conn.query("SELECT ID_SPACE id FROM SPACES WHERE TIPO='MERMA' LIMIT 1")
    if (!mermaZ) throw new Error('Zona MERMA no existe')

    if (source === 'PRIMARY') {
      // Validar saldo en origen
      const [[{ saldo }]] = await conn.query(
        `SELECT IFNULL(SUM(PESO),0) saldo FROM STOCK_ZONE WHERE ID_SPACE=? AND ID_PRIMATER=?`,
        [fromZ.id, itemId]
      )
      if (Number(saldo) + 1e-9 < qty) throw new Error('Stock insuficiente en origen')

      // Salida origen (negativo)
      await conn.query(
        `INSERT INTO STOCK_ZONE (ID_SPACE, ID_PRIMATER, PESO, FECHA, OBSERVACION)
         VALUES (?, ?, ?, NOW(), ?)`,
        [fromZ.id, itemId, -qty, note || 'Salida a MERMA']
      )
      // Entrada MERMA (positivo)
      await conn.query(
        `INSERT INTO STOCK_ZONE (ID_SPACE, ID_PRIMATER, PESO, FECHA, OBSERVACION)
         VALUES (?, ?, ?, NOW(), ?)`,
        [mermaZ.id, itemId, qty, note || `Desde ${from}`]
      )
    } else {
      // FINISHED
      const [[{ saldo }]] = await conn.query(
        `SELECT IFNULL(SUM(PESO),0) saldo FROM STOCK_FINISHED_PRODUCT WHERE ID_SPACE=? AND ID_PRODUCT=?`,
        [fromZ.id, itemId]
      )
      if (Number(saldo) + 1e-9 < qty) throw new Error('Stock insuficiente en origen')

      // Salida origen (negativo) → como manejas PT con tabla stock “acumulativa”, representamos salida con negativo
      await conn.query(
        `INSERT INTO STOCK_FINISHED_PRODUCT (ID_PRODUCT, ID_SPACE, PESO, FECHA, PRESENTATION_KG, ID_PRESENTATION)
         VALUES (?, ?, ?, NOW(), NULL, NULL)`,
        [itemId, fromZ.id, -qty]
      )
      // Entrada MERMA
      await conn.query(
        `INSERT INTO STOCK_FINISHED_PRODUCT (ID_PRODUCT, ID_SPACE, PESO, FECHA, PRESENTATION_KG, ID_PRESENTATION)
         VALUES (?, ?, ?, NOW(), NULL, NULL)`,
        [itemId, mermaZ.id, qty]
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

// backend/src/routes/stock.routes.js
// ...
// AUX: obtiene IDs de zonas de MERMA (por TIPO='MERMA' o nombre contiene 'MERMA')
async function getMermaZoneIds(conn) {
  const [rows] = await conn.query(
    `SELECT ID_SPACE id
       FROM SPACES
      WHERE TIPO='MERMA' OR UPPER(NOMBRE) LIKE '%MERMA%'`
  )
  return rows.map(r => Number(r.id))
}

// DELETE /api/stock/merma/:id
stockRouter.delete('/merma/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!id) return res.status(400).json({ error: 'ID inválido' })

  const conn = await pool.getConnection()
  try {
    const mermaIds = await getMermaZoneIds(conn)
    if (mermaIds.length === 0) return res.status(400).json({ error: 'Zonas de merma no configuradas' })

    // verificamos que el registro pertenezca a una zona de merma
    const [[row]] = await conn.query(
      `SELECT ID_STOCK_ZONE, ID_SPACE
         FROM STOCK_ZONE
        WHERE ID_STOCK_ZONE = ?`,
      [id]
    )
    if (!row) return res.status(404).json({ error: 'Registro no existe' })
    if (!mermaIds.includes(Number(row.ID_SPACE))) {
      return res.status(400).json({ error: 'El registro no pertenece a zona de merma' })
    }

    // eliminamos
    await conn.query(`DELETE FROM STOCK_ZONE WHERE ID_STOCK_ZONE = ?`, [id])
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error eliminando merma' })
  } finally {
    conn.release()
  }
})
// ==== DESCARTAR MERMA (restar definitivamente en zona MERMA) ====
// POST /api/stock/merma/remove
// body: { type:'PRIMARY'|'FINISHED', itemId:number, qty:number, note?:string }
stockRouter.post('/merma/remove', async (req, res) => {
  const type  = String(req.body?.type || '').toUpperCase()
  const itemId = Number(req.body?.itemId)
  const qty    = Number(req.body?.qty || 0)
  const note   = req.body?.note || 'Descargo definitivo de merma'

  if (!['PRIMARY','FINISHED'].includes(type)) {
    return res.status(400).json({ error: 'type debe ser PRIMARY o FINISHED' })
  }
  if (!itemId || !(qty > 0)) return res.status(400).json({ error: 'Datos inválidos' })

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // Buscar la primera zona con TIPO='MERMA'
    const [[mermaZone]] = await conn.query(
      `SELECT ID_SPACE id, NOMBRE name FROM SPACES WHERE TIPO='MERMA' ORDER BY ID_SPACE LIMIT 1`
    )
    if (!mermaZone) throw new Error('No existe zona MERMA configurada')

    // Saldo disponible en merma para ese item
    if (type === 'PRIMARY') {
      const [[r]] = await conn.query(
        `SELECT IFNULL(SUM(PESO),0) saldo
           FROM STOCK_ZONE
          WHERE ID_SPACE=? AND ID_PRIMATER=?`,
        [mermaZone.id, itemId]
      )
      const saldo = Number(r?.saldo || 0)
      if (saldo + 1e-9 < qty) {
        await conn.rollback()
        return res.status(400).json({ error: 'Merma insuficiente para descartar esa cantidad' })
      }
      // Insertar salida (negativo) en la misma zona MERMA
      await conn.query(
        `INSERT INTO STOCK_ZONE (ID_SPACE, ID_PRIMATER, PESO, FECHA, OBSERVACION)
         VALUES (?, ?, ?, NOW(), ?)`,
        [mermaZone.id, itemId, -qty, note]
      )
    } else {
      // FINISHED → STOCK_FINISHED_PRODUCT en la zona MERMA
      const [[r]] = await conn.query(
        `SELECT IFNULL(SUM(PESO),0) saldo
           FROM STOCK_FINISHED_PRODUCT
          WHERE ID_SPACE=? AND ID_PRODUCT=?`,
        [mermaZone.id, itemId]
      )
      const saldo = Number(r?.saldo || 0)
      if (saldo + 1e-9 < qty) {
        await conn.rollback()
        return res.status(400).json({ error: 'Merma de PT insuficiente para descartar esa cantidad' })
      }
      await conn.query(
        `INSERT INTO STOCK_FINISHED_PRODUCT (ID_PRODUCT, ID_SPACE, PESO, FECHA, PRESENTATION_KG, ID_PRESENTATION)
         VALUES (?, ?, ?, NOW(), NULL, NULL)`,
        [itemId, mermaZone.id, -qty]
      )
    }

    await conn.commit()
    res.json({ ok: true })
  } catch (e) {
    await conn.rollback()
    console.error(e)
    res.status(500).json({ error: 'Error al descartar merma' })
  } finally {
    conn.release()
  }
})
// === RESUMEN PT (por producto) ===
// GET /api/stock/finished/summary?q=&limit=30&offset=0
stockRouter.get('/finished/summary', async (req, res) => {
  try {
    const limit  = Math.min(Number(req.query.limit) || 30, 100)
    const offset = Number(req.query.offset) || 0
    const q      = (req.query.q || '').trim()

    const paramsQ = []
    let whereQ = ''
    if (q) {
      whereQ = ' AND p.DESCRIPCION LIKE ? '
      paramsQ.push(`%${q}%`)
    }

    // total de productos con stock>0 en ALMACEN
    const [[{ total }]] = await pool.query(
      `
      SELECT COUNT(*) total FROM (
        SELECT sfp.ID_PRODUCT
        FROM STOCK_FINISHED_PRODUCT sfp
        JOIN SPACES s ON s.ID_SPACE = sfp.ID_SPACE AND s.TIPO='ALMACEN'
        JOIN PRODUCTS p ON p.ID_PRODUCT = sfp.ID_PRODUCT
        WHERE 1=1
        ${whereQ}
        GROUP BY sfp.ID_PRODUCT
        HAVING SUM(sfp.PESO) > 0
      ) t
      `,
      paramsQ
    )

    // filas: resumen por producto
    const [rows] = await pool.query(
      `
      SELECT
        p.ID_PRODUCT          AS productId,
        p.DESCRIPCION         AS productName,
        ROUND(SUM(sfp.PESO),2) AS stockKg
      FROM STOCK_FINISHED_PRODUCT sfp
      JOIN SPACES s ON s.ID_SPACE = sfp.ID_SPACE AND s.TIPO='ALMACEN'
      JOIN PRODUCTS p ON p.ID_PRODUCT = sfp.ID_PRODUCT
      WHERE 1=1
      ${whereQ}
      GROUP BY p.ID_PRODUCT, p.DESCRIPCION
      HAVING SUM(sfp.PESO) > 0
      ORDER BY p.DESCRIPCION ASC
      LIMIT ? OFFSET ?
      `,
      [...paramsQ, limit, offset]
    )

    res.json({ items: rows, total: Number(total || 0) })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error listando resumen de PT' })
  }
})


// === DETALLE PT POR PRODUCTO (presentaciones) ===
// GET /api/stock/finished/by-product?productId=123
stockRouter.get('/finished/by-product', async (req, res) => {
  try {
    const productId = Number(req.query.productId || 0)
    if (!productId) return res.status(400).json({ error: 'productId requerido' })

    const [rows] = await pool.query(
      `
      SELECT
        IFNULL(sfp.ID_PRESENTATION, NULL) AS presentationId,
        CASE
          WHEN sfp.ID_PRESENTATION IS NOT NULL THEN MAX(pp.PESO_KG)
          ELSE MAX(sfp.PRESENTATION_KG)
        END AS presentationKg,
        ROUND(SUM(sfp.PESO),2) AS stockKg
      FROM STOCK_FINISHED_PRODUCT sfp
      JOIN SPACES s ON s.ID_SPACE = sfp.ID_SPACE AND s.TIPO='ALMACEN'
      LEFT JOIN PRODUCT_PRESENTATIONS pp
        ON pp.ID_PRESENTATION = sfp.ID_PRESENTATION
      WHERE sfp.ID_PRODUCT = ?
      GROUP BY IFNULL(sfp.ID_PRESENTATION, 0)
      HAVING SUM(sfp.PESO) > 0
      ORDER BY presentationKg ASC
      `,
      [productId]
    )

    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error listando presentaciones del producto' })
  }
})
