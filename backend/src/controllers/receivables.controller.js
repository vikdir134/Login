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
      // balance: "all" | "with" | "without"
      balance: z.enum(['all','with','without']).optional(),
      limit: z.coerce.number().int().positive().max(200).optional(),
      offset: z.coerce.number().int().nonnegative().optional()
    })

    const { q, balance = 'all', limit = 30, offset = 0 } = schema.parse(req.query)
    const data = await listCustomersWithDebt({ q, balance, limit, offset })
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error:'Error listando cuentas por cobrar' })
  }
}


export async function getCustomerReceivableCtrl(req, res) {
  try {
    const schema = z.object({
      onlyWithBalance: z.coerce.boolean().optional()
    })
    const { onlyWithBalance=false } = schema.parse(req.query)
    const id = Number(req.params.id)
    const data = await getCustomerReceivable({ customerId: id, onlyWithBalance })
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
