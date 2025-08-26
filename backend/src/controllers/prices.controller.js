// backend/src/controllers/prices.controller.js
import { z } from 'zod'
import { getEffectivePrice } from '../models/prices.model.js'

// GET /api/prices/effective?customerId=14&productId=13&date=YYYY-MM-DD (date opcional)
export async function getEffectivePriceCtrl(req, res) {
  try {
    const schema = z.object({
      customerId: z.coerce.number().int().positive(),
      productId: z.coerce.number().int().positive(),
      date: z.string().min(8).optional() // YYYY-MM-DD
    })
    const { customerId, productId, date } = schema.parse(req.query)

    const atDate = date || new Date().toISOString().slice(0,10)
    const row = await getEffectivePrice({ customerId, productId, atDate })

    // si no hay precio, retornamos 200 con price=0
    if (!row) return res.json({ price: 0, currency: 'PEN', effectiveFrom: null, effectiveTo: null })

    return res.json({
      price: Number(row.PRICE) || 0,
      currency: row.CURRENCY || 'PEN',
      effectiveFrom: row.VALID_FROM || null,
      effectiveTo: row.VALID_TO || null
    })
  } catch (e) {
    console.error(e)
    return res.status(400).json({ error: 'Parámetros inválidos' })
  }
}
