// backend/src/controllers/products.controller.js
import { pool } from '../db.js'

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
