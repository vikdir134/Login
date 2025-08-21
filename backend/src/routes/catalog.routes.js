// src/routes/catalog.routes.js
import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { pool } from '../db.js'

const router = Router()

router.get('/catalog/products', authRequired, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 1000, 1000)
    const [rows] = await pool.query(
      `SELECT ID_PRODUCT AS id, DESCRIPCION AS name
       FROM PRODUCTS
       ORDER BY DESCRIPCION
       LIMIT ?`,
      [limit]
    )
    res.json(Array.isArray(rows) ? rows : [])
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error listando productos' })
  }
})

export default router
