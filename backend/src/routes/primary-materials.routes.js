// src/routes/primary-materials.routes.js
import { Router } from 'express'
import { pool } from '../db.js'
export const primaryMaterialsRouter = Router()

primaryMaterialsRouter.get('/', async (_req, res) => {
  const [rows] = await pool.query(`
    SELECT pm.ID_PRIMATER id, pm.DESCRIPCION, pm.DENIER,
           m.ID_MATERIAL materialId, m.DESCRIPCION materialName,
           c.ID_COLOR colorId, c.DESCRIPCION colorName
    FROM PRIMARY_MATERIALS pm
    JOIN MATERIALS m ON m.ID_MATERIAL = pm.ID_MATERIAL
    LEFT JOIN COLORS c ON c.ID_COLOR = pm.ID_COLOR
    ORDER BY m.DESCRIPCION, c.DESCRIPCION, pm.DESCRIPCION
  `)
  res.json(rows)
})

primaryMaterialsRouter.post('/', async (req, res) => {
  const { materialId, colorId, descripcion, denier } = req.body
  if (!materialId) return res.status(400).json({ error: 'materialId requerido' })
  const [r] = await pool.query(
    `INSERT INTO PRIMARY_MATERIALS (ID_MATERIAL, ID_COLOR, DESCRIPCION, DENIER)
     VALUES (?, ?, ?, ?)`,
    [materialId, colorId ?? null, descripcion ?? null, denier ?? null]
  )
  res.status(201).json({ id: r.insertId })
})
