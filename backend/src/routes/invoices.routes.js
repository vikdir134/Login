// backend/src/routes/invoices.routes.js
import { Router } from 'express'
import { pool } from '../db.js'

export const invoicesRouter = Router()

// POST /api/invoices
// Body esperado: { code: string }
// (Tu tabla FACTURAS tiene: ID_FACTURA (AI), CODIGO, CREATED_AT)
invoicesRouter.post('/', async (req, res) => {
  try {
    const code = String(req.body?.code || '').trim()
    if (!code) return res.status(400).json({ error: 'code es requerido' })

    const [r] = await pool.query(
      `INSERT INTO FACTURAS (CODIGO, CREATED_AT) VALUES (?, NOW())`,
      [code]
    )

    // Devolver el id para enlazarlo en ORDER_DELIVERY.ID_FACTURA
    res.status(201).json({ id: r.insertId })
  } catch (e) {
    console.error('[POST /api/invoices] Error:', e)
    res.status(500).json({ error: 'Error creando factura' })
  }
})
