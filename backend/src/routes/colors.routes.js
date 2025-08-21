// src/routes/colors.routes.js
import { Router } from 'express'
import { pool } from '../db.js'
export const colorsRouter = Router()

colorsRouter.get('/', async (_req, res) => {
  const [rows] = await pool.query('SELECT ID_COLOR id, DESCRIPCION name FROM COLORS ORDER BY DESCRIPCION')
  res.json(rows)
})

colorsRouter.post('/', async (req, res) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' })
  const [r] = await pool.query('INSERT INTO COLORS (DESCRIPCION) VALUES (?)', [name.trim()])
  res.status(201).json({ id: r.insertId, name })
})
