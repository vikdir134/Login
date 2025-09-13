// backend/src/controllers/receivables.controller.js
import { z } from 'zod'
import {
  listCustomersWithDebt,
  getCustomerReceivable,   // usamos el nombre real del modelo
  getReceivablesSummary,
} from '../models/receivables.model.js'

export async function listCustomersWithDebtCtrl(req, res) {
  try {
    const schema = z.object({
      q: z.string().optional(),
      balance: z.enum(['all','with','without']).optional().default('all'),
      limit: z.coerce.number().int().positive().max(200).optional().default(30),
      offset: z.coerce.number().int().nonnegative().optional().default(0),
    })
    const { q, balance, limit, offset } = schema.parse(req.query)

    const data = await listCustomersWithDebt({ q, balance, limit, offset })
    res.json(data)
  } catch (e) {
    console.error('[listCustomersWithDebtCtrl]', e)
    res.status(500).json({ error:'Error listando cuentas por cobrar' })
  }
}

export async function getCustomerReceivableCtrl(req, res) {
  try {
    // tomamos el nombre de parámetro que usará la ruta: :customerId
    const pathSchema = z.object({
      customerId: z.coerce.number().int().positive(),
    })
    const { customerId } = pathSchema.parse(req.params)

    const querySchema = z.object({
      balance: z.enum(['all','with','without']).optional().default('all'),
      from: z.string().optional(),
      to: z.string().optional(),
    })
    const { balance, from, to } = querySchema.parse(req.query)

    const data = await getCustomerReceivable({
      customerId,
      balance,
      from,
      to,
    })

    res.json(data)
  } catch (e) {
    console.error('[getCustomerReceivableCtrl] error:', e)
    res.status(500).json({ error: 'Error obteniendo cuentas por cobrar del cliente' })
  }
}

export async function getReceivablesSummaryCtrl(_req, res) {
  try {
    const data = await getReceivablesSummary()
    res.json(data)
  } catch (e) {
    console.error('[getReceivablesSummaryCtrl]', e)
    res.status(500).json({ error:'Error obteniendo resumen global' })
  }
}
