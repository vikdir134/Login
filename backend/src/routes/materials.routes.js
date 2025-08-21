// src/routes/materials.routes.js
import { Router } from 'express'
import { pool } from '../db.js'
export const materialsRouter = Router()

materialsRouter.get('/', async (_req, res) => {
  const [rows] = await pool.query('SELECT ID_MATERIAL id, DESCRIPCION name FROM MATERIALS ORDER BY DESCRIPCION')
  res.json(rows)
})

materialsRouter.post('/', async (req, res) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' })
  const [r] = await pool.query('INSERT INTO MATERIALS (DESCRIPCION) VALUES (?)', [name.trim()])
  res.status(201).json({ id: r.insertId, name })
})
