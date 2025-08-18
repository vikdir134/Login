import { z } from 'zod'
import { CustomerModel } from '../models/customer.model.js'

const createSchema = z.object({
  ruc: z.string().min(8).max(20),
  razonSocial: z.string().min(2).max(60),
  activo: z.boolean().optional()
})

const updateSchema = z.object({
  ruc: z.string().min(8).max(20).optional(),
  razonSocial: z.string().min(2).max(60).optional(),
  activo: z.boolean().optional()
})

export async function listCustomers(req, res) {
  try {
    const { q, activo } = req.query
    const data = await CustomerModel.getAll({ q, activo })
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error listando clientes' })
  }
}

export async function getCustomer(req, res) {
  try {
    const c = await CustomerModel.getById(req.params.id)
    if (!c) return res.status(404).json({ error: 'Cliente no encontrado' })
    res.json(c)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error obteniendo cliente' })
  }
}

export async function createCustomer(req, res) {
  try {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message })
    }
    const c = await CustomerModel.create(parsed.data)
    res.status(201).json(c)
  } catch (e) {
    console.error(e)
    if (e?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'RUC o Razón Social ya registrado' })
    }
    res.status(500).json({ error: 'Error creando cliente' })
  }
}

export async function updateCustomer(req, res) {
  try {
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message })
    }
    const c = await CustomerModel.update(req.params.id, parsed.data)
    if (!c) return res.status(404).json({ error: 'Cliente no encontrado' })
    res.json(c)
  } catch (e) {
    console.error(e)
    if (e?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'RUC o Razón Social ya registrado' })
    }
    res.status(500).json({ error: 'Error actualizando cliente' })
  }
}

export async function deleteCustomer(req, res) {
  try {
    const ok = await CustomerModel.remove(req.params.id)
    if (!ok) return res.status(404).json({ error: 'Cliente no encontrado' })
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error eliminando cliente' })
  }
}
