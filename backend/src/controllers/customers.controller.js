import { z } from 'zod'
import { CustomersModel } from '../models/customers.model.js'

export async function listCustomers(req, res) {
  try {
    const q = String(req.query.q || '')
    const active = req.query.active === undefined ? null
                  : (req.query.active === 'true' || req.query.active === '1')
    const limit = Number(req.query.limit || 50)
    const offset = Number(req.query.offset || 0)
    const rows = await CustomersModel.list({ q, active, limit, offset })
    res.json(rows)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error listando clientes' })
  }
}

const createSchema = z.object({
  ruc: z.string().trim().min(8).max(20),
  razonSocial: z.string().trim().min(2).max(30),
  activo: z.boolean().optional()
})

export async function createCustomer(req, res) {
  try {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })
    const customer = await CustomersModel.create(parsed.data)
    res.status(201).json(customer)
  } catch (e) {
    console.error(e)
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'RUC o Razón Social ya registrados' })
    res.status(500).json({ error: 'Error creando cliente' })
  }
}

export async function getCustomerSummary(req, res) {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' })
    const data = await CustomersModel.getSummary(id)
    if (!data) return res.status(404).json({ error: 'Cliente no existe' })
    res.json(data)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error obteniendo cliente' })
  }
}
