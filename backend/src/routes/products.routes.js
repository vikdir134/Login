// src/routes/products.routes.js
import { Router } from 'express'
import { pool } from '../db.js'
export const productsRouter = Router()

productsRouter.get('/', async (_req, res) => {
  const [rows] = await pool.query(`
    SELECT ID_PRODUCT id, TIPO_PRODUCTO tipoProducto, DIAMETER diameter, DESCRIPCION
    FROM PRODUCTS ORDER BY DESCRIPCION
  `)
  res.json(rows)
})

productsRouter.post('/', async (req, res) => {
  const { tipoProducto, diameter, descripcion } = req.body
  if (!tipoProducto || !diameter || !descripcion) {
    return res.status(400).json({ error: 'Campos requeridos: tipoProducto, diameter, descripcion' })
  }
  const [r] = await pool.query(
    `INSERT INTO PRODUCTS (TIPO_PRODUCTO, DIAMETER, DESCRIPCION)
     VALUES (?, ?, ?)`,
    [tipoProducto, diameter, descripcion]
  )
  res.status(201).json({ id: r.insertId, tipoProducto, diameter, descripcion })
})

// composición opcional
productsRouter.post('/:id/composition', async (req, res) => {
  const { id } = req.params
  const { items } = req.body // [{primaterId, zone, percentage}]
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items requerido' })

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    for (const it of items) {
      if (!it.primaterId || !it.zone || typeof it.percentage !== 'number') {
        throw new Error('Item inválido')
      }
      await conn.query(
        `INSERT INTO PRODUCT_COMPOSITION (ID_PRODUCT, ID_PRIMATER, ZONE, PERCENTAGE)
         VALUES (?, ?, ?, ?)`,
        [id, it.primaterId, it.zone, it.percentage]
      )
    }
    await conn.commit()
    res.status(201).json({ ok: true })
  } catch (e) {
    await conn.rollback()
    res.status(400).json({ error: e.message })
  } finally {
    conn.release()
  }
})
