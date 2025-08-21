// src/routes/zones.routes.js
import { Router } from 'express'
import { pool } from '../db.js'
export const zonesRouter = Router()

zonesRouter.get('/', async (_req, res) => {
  const [rows] = await pool.query('SELECT ID_SPACE id, NOMBRE name FROM SPACES ORDER BY NOMBRE')
  res.json(rows)
})
