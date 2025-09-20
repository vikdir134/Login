// src/controllers/orders.controller.js
import { z } from 'zod'
import {
  createOrderWithLines,
  getOrderById,
  listOrders,
  updateOrderState,
  recomputeAndSetOrderState,
  setOrderStateByName,
  listOrdersInProcess,
  listOrdersWithStates,
  listOrdersByStates
} from '../models/orders.model.js'

const lineSchema = z.object({
  productId: z.number().int().positive(),
  peso: z.number().positive(),
  presentacion: z.number().positive()
})

export async function listOrdersInProcessCtrl(req, res) {
  try {
    const q = (req.query.q || '').trim()
    const limit = Math.min(Number(req.query.limit) || 50, 200)
    const offset = Math.max(Number(req.query.offset) || 0, 0)
    const data = await listOrdersInProcess({ q, limit, offset })
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error listando pedidos en proceso' })
  }
}

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
    const id = Number(req.params.id)
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: 'ID de pedido inválido' })
    }
    const order = await getOrderById(id)
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
      state: z.string().optional(),          // ← puede venir como "PENDIENTE,EN_PROCESO"
      from: z.string().optional(),
      to: z.string().optional(),
      q: z.string().optional(),
      limit: z.coerce.number().int().positive().max(200).optional(),
      offset: z.coerce.number().int().nonnegative().optional()
    })

    const parsed = schema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message })
    }

    // 🔹 NUEVO: soportar múltiples estados separados por coma
    const stateParam = (parsed.data.state || '').trim()
    const states = stateParam
      ? stateParam.split(',').map(s => s.trim()).filter(Boolean)
      : undefined

    // Llamamos al model pasando "states" (array) en vez de "state" (string)
    const data = await listOrders({ ...parsed.data, states })
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
export async function listOrdersCombinedCtrl(req, res) {
  try {
    // state llega como "PENDIENTE,EN_PROCESO" (opcional)
    const q      = (req.query.q || '').trim()
    const limit  = Math.min(Number(req.query.limit) || 50, 200)
    const offset = Math.max(Number(req.query.offset) || 0, 0)

    const stateParam = (req.query.state || '').trim()
    const states = stateParam
      ? stateParam.split(',').map(s => s.trim()).filter(Boolean)
      : undefined

    const data = await listOrdersWithStates({ q, limit, offset, states })
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error listando pedidos (combined)' })
  }
}
export async function searchOrdersCtrl(req, res) {
  try {
    const q      = (req.query.q || '').trim()
    const limit  = Math.min(Number(req.query.limit) || 50, 200)
    const offset = Math.max(Number(req.query.offset) || 0, 0)

    // CSV de estados: "PENDIENTE,EN_PROCESO,ENTREGADO,CANCELADO"
    const csv = (req.query.state || '').trim()
    let states = []
    if (csv) {
      states = csv.split(',').map(s => s.trim()).filter(Boolean)
    }

    // Validación de estados permitidos (mantengo tu lógica)
    const allowed = new Set(['PENDIENTE','EN_PROCESO','ENTREGADO','CANCELADO'])
    states = states.filter(s => allowed.has(s))

    // ⬇️ NUEVO: tomar rango de fechas
    const from = (req.query.from || '').trim() || undefined   // "YYYY-MM-DD"
    const to   = (req.query.to   || '').trim() || undefined   // "YYYY-MM-DD"

    // ⬇️ CAMBIO CLAVE: usar listOrdersWithStates (soporta from/to y devuelve {items,total})
    const data = await listOrdersWithStates({
      q,
      states: states.length ? states : undefined,
      from,   // el model aplica 00:00:00
      to,     // el model aplica 23:59:59
      limit,
      offset,
    })

    return res.json(data)
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Error buscando pedidos' })
  }
}
