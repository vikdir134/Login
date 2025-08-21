// src/controllers/presentations.controller.js
import { z } from 'zod'
import { pool } from '../db.js'

const createSchema = z.object({
  productId: z.number().int().positive(),
  presentationKg: z.number().positive()
})

// POST /api/product-presentations
export async function createPresentationCtrl(req, res) {
  try {
    const parsed = createSchema.safeParse({
      productId: Number(req.body?.productId),
      presentationKg: Number(req.body?.presentationKg),
    })
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message })
    }
    const { productId, presentationKg } = parsed.data

    // valida producto
    const [prod] = await pool.query(
      'SELECT ID_PRODUCT FROM PRODUCTS WHERE ID_PRODUCT = ? LIMIT 1',
      [productId]
    )
    if (!prod.length) return res.status(404).json({ error: 'Producto no existe' })

    // INSERT en PESO_KG (NO en PRESENTATION_KG)
    const [r] = await pool.query(
      `INSERT INTO PRODUCT_PRESENTATIONS (ID_PRODUCT, PESO_KG)
       VALUES (?, ?)`,
      [productId, presentationKg]
    )

    res.status(201).json({ id: r.insertId, productId, presentationKg })
  } catch (e) {
    console.error(e)
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe esa presentación para este producto' })
    }
    res.status(500).json({ error: 'Error creando presentación' })
  }
}

// GET /api/product-presentations?productId=10
export async function listPresentationsCtrl(req, res) {
  try {
    const productId = req.query.productId ? Number(req.query.productId) : null
    let sql = `
      SELECT
        ID_PRESENTATION AS id,
        ID_PRODUCT      AS productId,
        PESO_KG         AS presentationKg
      FROM PRODUCT_PRESENTATIONS
    `
    const params = []
    if (productId) { sql += ' WHERE ID_PRODUCT = ?'; params.push(productId) }
    sql += ' ORDER BY PESO_KG'

    const [rows] = await pool.query(sql, params)
    res.json(Array.isArray(rows) ? rows : [])
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error listando presentaciones' })
  }
}
