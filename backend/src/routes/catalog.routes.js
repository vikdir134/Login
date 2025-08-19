// src/routes/catalog.routes.js
import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import { pool } from '../db.js'

const router = Router()

router.get('/customers', authRequired, requireRole(['ALMACENERO','PRODUCCION','JEFE','ADMINISTRADOR']), async (req, res) => {
  const [rows] = await pool.query(
    'SELECT ID_CUSTOMER AS id, RAZON_SOCIAL AS name FROM CUSTOMERS ORDER BY RAZON_SOCIAL LIMIT ?',
    [Number(req.query.limit || 100)]
  )
  res.json(rows)
})

router.get('/products', authRequired, requireRole(['ALMACENERO','PRODUCCION','JEFE','ADMINISTRADOR']), async (req, res) => {
  const [rows] = await pool.query(
    'SELECT ID_PRODUCT AS id, DESCRIPCION AS name FROM PRODUCTS ORDER BY DESCRIPCION LIMIT ?',
    [Number(req.query.limit || 100)]
  )
  res.json(rows)
})

export default router
