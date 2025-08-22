// backend/src/controllers/products.controller.js
import { pool } from '../db.js'

const ZONAS_VALIDAS = new Set(['TRONCO','ALMA','CUBIERTA'])

export async function updateProductCompositionCtrl(req, res) {
  const productId = Number(req.params.id || 0)
  const items = Array.isArray(req.body?.items) ? req.body.items : []

  // log opcional para depurar rápido en consola
  // console.log('PUT composition body:', JSON.stringify(req.body, null, 2))

  if (!productId) {
    return res.status(400).json({ error: 'productId inválido' })
  }
  if (!items.length) {
    return res.status(400).json({ error: 'Debe enviar al menos una fila de composición' })
  }

  // validar producto
  const [[prod]] = await pool.query(
    'SELECT ID_PRODUCT AS id FROM PRODUCTS WHERE ID_PRODUCT = ? LIMIT 1',
    [productId]
  )
  if (!prod) return res.status(404).json({ error: 'Producto no existe' })

  // normalizar y validar filas
  let total = 0
  const norm = []
  for (const it of items) {
    const primaterId = Number(it.primaterId)
    const zone = String(it.zone || '').toUpperCase()
    const percentage = Number(it.percentage)

    if (!primaterId) {
      return res.status(400).json({ error: 'Fila con primaterId inválido' })
    }
    if (!ZONAS_VALIDAS.has(zone)) {
      return res.status(400).json({ error: `Zona inválida: ${zone}` })
    }
    if (!(percentage > 0)) {
      return res.status(400).json({ error: 'El porcentaje debe ser > 0' })
    }

    // validar MP existe
    const [[mp]] = await pool.query(
      'SELECT ID_PRIMATER AS id FROM PRIMARY_MATERIALS WHERE ID_PRIMATER = ? LIMIT 1',
      [primaterId]
    )
    if (!mp) {
      return res.status(400).json({ error: `Materia prima #${primaterId} no existe` })
    }

    norm.push({ primaterId, zone, percentage })
    total += percentage
  }

  if (total > 100 + 1e-9) {
    return res.status(400).json({ error: `La suma de porcentajes (${total.toFixed(2)}%) no debe exceder 100%` })
  }
  // si quieres EXACTO 100%, usa:
  // if (Math.abs(total - 100) > 1e-9) return res.status(400).json({ error: 'La suma debe ser exactamente 100%' })

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // limpiar composición previa
    await conn.query('DELETE FROM PRODUCT_COMPOSITION WHERE ID_PRODUCT = ?', [productId])

    // insertar nueva
    for (const r of norm) {
      await conn.query(
        `INSERT INTO PRODUCT_COMPOSITION
          (ID_PRODUCT, ID_PRIMATER, ZONE, PERCENTAGE)
         VALUES (?, ?, ?, ?)`,
        [productId, r.primaterId, r.zone, r.percentage]
      )
    }

    await conn.commit()
    return res.json({ ok: true, totalPercent: total })
  } catch (e) {
    await conn.rollback()
    console.error('updateProductCompositionCtrl error:', e)
    // errores de CHECK (0..100) o FK caen aquí -> 400 legible
    if (e.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
      return res.status(400).json({ error: 'Porcentaje fuera de rango (0..100)' })
    }
    if (e.code === 'ER_NO_REFERENCED_ROW_2' || e.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({ error: 'Violación de clave foránea en composición' })
    }
    return res.status(500).json({ error: 'Error guardando composición' })
  } finally {
    conn.release()
  }
}


// POST /api/products
export async function createProductCtrl(req, res) {
  try {
    const tipo = String(req.body?.tipo || '').trim()
    const diameter = String(req.body?.diameter || '').trim()
    const descripcion = String(req.body?.descripcion || '').trim()

    if (!tipo || !diameter || !descripcion) {
      return res.status(400).json({ error: 'Complete tipo, diámetro y descripción' })
    }

    const [r] = await pool.query(
      `INSERT INTO PRODUCTS (TIPO_PRODUCTO, DIAMETER, DESCRIPCION)
       VALUES (?, ?, ?)`,
      [tipo, diameter, descripcion]
    )
    res.status(201).json({ id: r.insertId, tipo, diameter, descripcion })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error creando producto' })
  }
}
export async function upsertProductCompositionCtrl(req, res) {
  const productId = Number(req.params.id)
  if (!productId) return res.status(400).json({ error: 'ID de producto inválido' })

  const items = Array.isArray(req.body?.items) ? req.body.items : []
  if (items.length === 0) return res.status(400).json({ error: 'Debe enviar al menos una fila de composición' })

  const ALLOWED_ZONES = new Set(['TRONCO','ALMA','CUBIERTA'])

  // Validaciones básicas
  for (const it of items) {
    if (!it?.primaterId || !ALLOWED_ZONES.has(String(it.zone))) {
      return res.status(400).json({ error: 'Fila de composición inválida (primaterId/zone)' })
    }
    if (!(Number(it.percentage) > 0)) {
      return res.status(400).json({ error: 'El porcentaje debe ser mayor a 0' })
    }
  }
  const total = items.reduce((a,b)=> a + Number(b.percentage || 0), 0)
  if (total > 100 + 1e-9) {
    return res.status(400).json({ error: 'La suma de porcentajes no puede exceder 100%' })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // Verifica que el producto exista
    const [[prod]] = await conn.query(
      'SELECT ID_PRODUCT FROM PRODUCTS WHERE ID_PRODUCT = ? LIMIT 1',
      [productId]
    )
    if (!prod) {
      await conn.rollback()
      return res.status(404).json({ error: 'Producto no existe' })
    }

    // Verifica que las MP existan
    const ids = items.map(i => Number(i.primaterId))
    const [found] = await conn.query(
      `SELECT ID_PRIMATER FROM PRIMARY_MATERIALS WHERE ID_PRIMATER IN (${ids.map(()=>'?').join(',')})`,
      ids
    )
    const foundSet = new Set(found.map(x => Number(x.ID_PRIMATER)))
    for (const id of ids) {
      if (!foundSet.has(id)) {
        await conn.rollback()
        return res.status(400).json({ error: `Materia prima ${id} no existe` })
      }
    }

    // Reemplaza composición (delete + insert)
    await conn.query('DELETE FROM PRODUCT_COMPOSITION WHERE ID_PRODUCT = ?', [productId])

    const values = []
    const placeholders = []
    for (const it of items) {
      placeholders.push('(?, ?, ?, ?)') // ID_PRODUCT, ID_PRIMATER, ZONE, PERCENTAGE
      values.push(productId, Number(it.primaterId), String(it.zone), Number(it.percentage))
    }

    await conn.query(
      `INSERT INTO PRODUCT_COMPOSITION (ID_PRODUCT, ID_PRIMATER, ZONE, PERCENTAGE)
       VALUES ${placeholders.join(',')}`,
      values
    )

    await conn.commit()
    return res.status(201).json({ ok: true, count: items.length })
  } catch (e) {
    await conn.rollback()
    console.error(e)
    return res.status(500).json({ error: 'Error guardando composición' })
  } finally {
    conn.release()
  }
}
/**
 * GET /api/products/without-composition?q=&limit=&offset=
 * Devuelve productos que NO tienen filas en PRODUCT_COMPOSITION.
 * Respuesta: [{ id, name }]
 */
export async function listProductsWithoutCompositionCtrl(req, res) {
  try {
    const q = String(req.query.q || '').trim()
    const limit = Math.min(Number(req.query.limit) || 1000, 1000)
    const offset = Math.max(Number(req.query.offset) || 0, 0)

    const params = []
    let where = ' WHERE 1=1 '
    if (q) { where += ' AND p.DESCRIPCION LIKE ? '; params.push(`%${q}%`) }

    const [rows] = await pool.query(
      `
      SELECT
        p.ID_PRODUCT   AS id,
        p.DESCRIPCION  AS name
      FROM PRODUCTS p
      LEFT JOIN PRODUCT_COMPOSITION pc
        ON pc.ID_PRODUCT = p.ID_PRODUCT
      ${where}
      GROUP BY p.ID_PRODUCT, p.DESCRIPCION
      HAVING COUNT(pc.ID_COMPOSITION) = 0
      ORDER BY p.DESCRIPCION ASC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    )

    res.json(Array.isArray(rows) ? rows : [])
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error listando productos sin composición' })
  }
}

/**
 * PUT /api/products/:id/composition
 * body: { items: [{ primaterId, zone:'TRONCO'|'ALMA'|'CUBIERTA', percentage }] }
 */
export async function setCompositionCtrl(req, res) {
  const productId = Number(req.params.id)
  if (!productId) return res.status(400).json({ error: 'Producto inválido' })
  const items = Array.isArray(req.body?.items) ? req.body.items : []

  if (!items.length) {
    // permitir limpiar composición
    try {
      await pool.query(`DELETE FROM PRODUCT_COMPOSITION WHERE ID_PRODUCT=?`, [productId])
      return res.json({ ok: true, count: 0 })
    } catch (e) {
      console.error(e)
      return res.status(500).json({ error: 'Error limpiando composición' })
    }
  }

  // validación
  const validZones = new Set(['TRONCO', 'ALMA', 'CUBIERTA'])
  let total = 0
  for (const it of items) {
    const pid = Number(it.primaterId)
    const zone = String(it.zone || '').toUpperCase()
    const pct = Number(it.percentage)

    if (!pid || !validZones.has(zone) || !(pct > 0)) {
      return res.status(400).json({ error: 'Ítems de composición inválidos' })
    }
    total += pct
  }
  if (total > 100 + 1e-9) {
    return res.status(400).json({ error: 'La suma de porcentajes no puede exceder 100%' })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // verificar que el producto exista
    const [[p]] = await conn.query(
      `SELECT ID_PRODUCT FROM PRODUCTS WHERE ID_PRODUCT=? LIMIT 1`,
      [productId]
    )
    if (!p) throw new Error('Producto no existe')

    // verificar que todas las MP existen
    const ids = items.map(x => Number(x.primaterId))
    const [exist] = await conn.query(
      `SELECT ID_PRIMATER FROM PRIMARY_MATERIALS WHERE ID_PRIMATER IN (${ids.map(()=>'?').join(',')})`,
      ids
    )
    if (!exist || exist.length !== ids.length) {
      throw new Error('Alguna materia prima no existe')
    }

    // reemplazar composición
    await conn.query(`DELETE FROM PRODUCT_COMPOSITION WHERE ID_PRODUCT=?`, [productId])
    for (const it of items) {
      await conn.query(
        `INSERT INTO PRODUCT_COMPOSITION (ID_PRODUCT, ID_PRIMATER, ZONE, PERCENTAGE)
         VALUES (?, ?, ?, ?)`,
        [productId, Number(it.primaterId), String(it.zone).toUpperCase(), Number(it.percentage)]
      )
    }

    await conn.commit()
    res.json({ ok: true, count: items.length })
  } catch (e) {
    await conn.rollback()
    const msg = e.message || 'Error guardando composición'
    if (/no existe|no puede exceder|no existe/.test(msg)) {
      return res.status(400).json({ error: msg })
    }
    console.error(e)
    res.status(500).json({ error: 'Error guardando composición' })
  } finally {
    conn.release()
  }
}
