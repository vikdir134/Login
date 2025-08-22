// src/controllers/orders.controller.js
import { z } from 'zod'
import {
  createOrderWithLines,
  getOrderById,
  listOrders,
  updateOrderState,recomputeAndSetOrderState, setOrderStateByName
} from '../models/orders.model.js'

const lineSchema = z.object({
  productId: z.number().int().positive(),
  peso: z.number().positive(),
  presentacion: z.number().positive()
})

export async function createOrder(req, res) {
  try {
    const schema = z.object({
      customerId: z.number().int().positive(),
      lines: z.array(lineSchema).nonempty()
    })

    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })

    const createdBy = req.user?.id ?? null
    const orderId = await createOrderWithLines({ ...parsed.data, createdBy })
    const order = await getOrderById(orderId)
    res.status(201).json(order)
  } catch (e) {
    console.error(e)
    if (e.code === 'STATE_NOT_FOUND') return res.status(400).json({ error: 'Estado PENDIENTE no existe' })
    res.status(500).json({ error: 'Error creando pedido' })
  }
}

export async function getOrder(req, res) {
  try {
    const { id } = req.params
    const order = await getOrderById(Number(id))
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' })
    res.json(order)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error obteniendo pedido' })
  }
}

export async function listOrdersCtrl(req, res) {
  try {
    const schema = z.object({
      customerId: z.coerce.number().int().positive().optional(),
      state: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      q: z.string().optional(),
      limit: z.coerce.number().int().positive().max(200).optional(),
      offset: z.coerce.number().int().nonnegative().optional()
    })

    const parsed = schema.safeParse(req.query)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })

    const data = await listOrders(parsed.data)
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error listando pedidos' })
  }
}

export async function changeOrderState(req, res) {
  try {
    const schema = z.object({ state: z.enum(['PENDIENTE','EN_PROCESO','ENTREGADO','CANCELADO']) })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })

    const ok = await updateOrderState(Number(req.params.id), parsed.data.state)
    if (!ok) return res.status(404).json({ error: 'Pedido no encontrado' })
    const order = await getOrderById(Number(req.params.id))
    res.json(order)
  } catch (e) {
    console.error(e)
    if (e.code === 'STATE_NOT_FOUND') return res.status(400).json({ error: 'Estado inválido' })
    res.status(500).json({ error: 'Error cambiando estado' })
  }
}
export async function cancelOrderCtrl(req, res) {
  try {
    const orderId = Number(req.params.id)
    const ok = await setOrderStateByName(orderId, 'CANCELADO')
    if (!ok) return res.status(404).json({ error: 'Pedido no encontrado' })
    const order = await getOrderById(orderId)
    res.json(order)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error cancelando pedido' })
  }
}

export async function reactivateOrderCtrl(req, res) {
  try {
    const orderId = Number(req.params.id)
    const ok = await recomputeAndSetOrderState(orderId)
    if (!ok) return res.status(404).json({ error: 'Pedido no encontrado' })
    const order = await getOrderById(orderId)
    res.json(order)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error reactivando pedido' })
  }
}