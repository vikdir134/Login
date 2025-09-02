// backend/src/controllers/receivables.controller.js
import { z } from 'zod'
import {
  listCustomersWithDebt,
  getCustomerReceivable,
  getReceivablesSummary
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
    console.error(e)
    res.status(500).json({ error:'Error listando cuentas por cobrar' })
  }
}

export async function getCustomerReceivableCtrl(req, res) {
  try {
    // balance: all | with | without (default: all)
    // from/to: YYYY-MM-DD (opcional)
    const schema = z.object({
      balance: z.enum(['all','with','without']).optional().default('all'),
      from: z.string().optional(),
      to: z.string().optional(),
    })
    const { balance, from, to } = schema.parse(req.query)
    const id = Number(req.params.id)

    const data = await getCustomerReceivable({
      customerId: id,
      balance,
      from,
      to,
    })
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error:'Error obteniendo cuentas del cliente' })
  }
}

export async function getReceivablesSummaryCtrl(_req, res) {
  try {
    const data = await getReceivablesSummary()
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error:'Error obteniendo resumen global' })
  }
}
