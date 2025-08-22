// backend/src/controllers/product-composition.controller.js
import { pool } from '../db.js'

/**
 * Payload esperado:
 * { lines: [{ primaterId:number, zone:'TRONCO'|'ALMA'|'CUBIERTA', percentage:number }, ...] }
 * Reemplaza completamente la composición del producto.
 */
export async function upsertCompositionCtrl(req, res) {
  const productId = Number(req.params.id)
  const lines = Array.isArray(req.body?.lines) ? req.body.lines : []

  if (!productId) return res.status(400).json({ error: 'Producto inválido' })
  if (lines.length === 0) return res.status(400).json({ error: 'Debe indicar al menos una línea' })

  // Validar
  let sum = 0
  for (const l of lines) {
    if (!l.primaterId || !['TRONCO','ALMA','CUBIERTA'].includes(String(l.zone))) {
      return res.status(400).json({ error: 'Líneas inválidas' })
    }
    const p = Number(l.percentage)
    if (!(p >= 0 && p <= 100)) return res.status(400).json({ error: 'Porcentaje inválido' })
    sum += p
  }
  if (sum > 100.000001) return res.status(400).json({ error: 'La suma de porcentajes no puede superar 100%' })

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // Verifica que el producto exista
    const [[prod]] = await conn.query(
      'SELECT ID_PRODUCT FROM PRODUCTS WHERE ID_PRODUCT=? LIMIT 1',
      [productId]
    )
    if (!prod) {
      await conn.rollback()
      return res.status(404).json({ error: 'Producto no existe' })
    }

    // Reemplazar composición
    await conn.query('DELETE FROM PRODUCT_COMPOSITION WHERE ID_PRODUCT=?', [productId])

    const values = lines.map(l => [
      productId,
      Number(l.primaterId),
      String(l.zone),
      Number(l.percentage)
    ])

    await conn.query(
      `INSERT INTO PRODUCT_COMPOSITION (ID_PRODUCT, ID_PRIMATER, ZONE, PERCENTAGE)
       VALUES ?`,
      [values]
    )

    await conn.commit()
    res.json({ ok: true })
  } catch (e) {
    await conn.rollback()
    console.error(e)
    res.status(500).json({ error: 'Error guardando composición' })
  } finally {
    conn.release()
  }
}
