import { z } from 'zod'
import { SuppliersModel } from '../models/suppliers.model.js'

const createSchema = z.object({
  ruc: z.string().min(8).max(20),
  name: z.string().min(2).max(100),
  address: z.string().max(150).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  email: z.string().email().max(100).nullable().optional(),
  contact: z.string().max(100).nullable().optional(),
  active: z.boolean().optional()
})

export async function listSuppliers(req, res) {
  try {
    const q = String(req.query.q || '')
    const limit = Number(req.query.limit || 50)
    const offset = Number(req.query.offset || 0)
    const rows = await SuppliersModel.list({ q, limit, offset })
    res.json(rows)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error listando proveedores' })
  }
}

export async function createSupplier(req, res) {
  try {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })
    const sup = await SuppliersModel.create(parsed.data)
    res.status(201).json(sup)
  } catch (e) {
    console.error(e)
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'RUC ya registrado' })
    res.status(500).json({ error: 'Error creando proveedor' })
  }
}
