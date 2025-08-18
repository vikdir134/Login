import { z } from 'zod'
import { SuppliersModel } from '../models/suppliers.model.js'

const createSchema = z.object({
  name: z.string().min(2).max(120),
  ruc: z.string().min(8).max(20).optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email().max(100).optional().nullable(),
  contactPerson: z.string().max(100).optional().nullable(),
  active: z.boolean().optional()
})

export async function listSuppliers(req, res) {
  try {
    const { q, active } = req.query
    const data = await SuppliersModel.list({ q, active })
    res.json(data)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error listando proveedores' })
  }
}

export async function getSupplier(req, res) {
  try {
    const one = await SuppliersModel.get(req.params.id)
    if (!one) return res.status(404).json({ error: 'Proveedor no encontrado' })
    res.json(one)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error obteniendo proveedor' })
  }
}

export async function createSupplier(req, res) {
  try {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })
    const created = await SuppliersModel.create(parsed.data)
    res.status(201).json(created)
  } catch (e) {
    console.error(e)
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Proveedor duplicado' })
    res.status(500).json({ error: 'Error creando proveedor' })
  }
}

export async function updateSupplier(req, res) {
  try {
    const parsed = createSchema.partial().safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })
    const updated = await SuppliersModel.update(req.params.id, parsed.data)
    if (!updated) return res.status(404).json({ error: 'Proveedor no encontrado' })
    res.json(updated)
  } catch (e) {
    console.error(e)
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Proveedor duplicado' })
    res.status(500).json({ error: 'Error actualizando proveedor' })
  }
}

export async function deleteSupplier(req, res) {
  try {
    const ok = await SuppliersModel.remove(req.params.id)
    if (!ok) return res.status(404).json({ error: 'Proveedor no encontrado' })
    res.json({ ok: true })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error eliminando proveedor' })
  }
}
