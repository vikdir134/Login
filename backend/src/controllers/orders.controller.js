import { z } from 'zod'
import { OrdersModel } from '../models/orders.model.js'

export async function listOrders(req, res) {
  try {
    const customerId = req.query.customerId ? Number(req.query.customerId) : null
    const state = req.query.state || null
    const from = req.query.from || null
    const to = req.query.to || null
    const limit = Number(req.query.limit || 50)
    const offset = Number(req.query.offset || 0)
    const rows = await OrdersModel.list({ customerId, state, from, to, limit, offset })
    res.json(rows)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error listando pedidos' })
  }
}

export async function getOrder(req, res) {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' })
    const data = await OrdersModel.getOne(id)
    if (!data) return res.status(404).json({ error: 'Pedido no existe' })
    res.json(data)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error obteniendo pedido' })
  }
}

const lineSchema = z.object({
  productId: z.coerce.number().int().positive(),
  peso: z.coerce.number().positive(),
  presentacion: z.coerce.number().positive()
})
const createSchema = z.object({
  customerId: z.coerce.number().int().positive(),
  fecha: z.string().min(8), // YYYY-MM-DD o con hora
  stateName: z.string().default('PENDIENTE'),
  lines: z.array(lineSchema).nonempty()
})

export async function createOrder(req, res) {
  try {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })
    const createdBy = req.user?.id ?? null
    const order = await OrdersModel.create({ ...parsed.data, createdBy })
    res.status(201).json(order)
  } catch (e) {
    console.error(e)
    if (e.code === 'STATE_NOT_FOUND') return res.status(400).json({ error: 'Estado inválido' })
    res.status(500).json({ error: 'Error creando pedido' })
  }
}
