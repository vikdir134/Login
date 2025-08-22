// src/controllers/orders.lines.controller.js
import { z } from 'zod'
import {
  addOrderLine,
  updateOrderLine,
  deleteOrderLine,
  getOrderById,
  getDeliveredForLine,
} from '../models/orders.model.js'
import { DeliveriesModel } from '../models/deliveries.model.js'

const addLineSchema = z.object({
  productId: z.number().int().positive(),
  peso: z.number().positive(),
  presentacion: z.number().positive(),
})

const patchLineSchema = z.object({
  peso: z.number().positive().optional(),
  presentacion: z.number().positive().optional(),
})

export async function addOrderLineCtrl(req, res) {
  try {
    const orderId = Number(req.params.id)
    const parsed = addLineSchema.safeParse({
      productId: Number(req.body?.productId),
      peso: Number(req.body?.peso),
      presentacion: Number(req.body?.presentacion),
    })
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })

    const lineId = await addOrderLine(orderId, parsed.data)
    const order = await getOrderById(orderId)
    return res.status(201).json({ ok: true, lineId, order })
  } catch (e) {
    if (e.code === 'ORDER_NOT_FOUND') return res.status(404).json({ error: 'Pedido no existe' })
    console.error(e)
    return res.status(500).json({ error: 'Error agregando línea' })
  }
}

export async function updateOrderLineCtrl(req, res) {
  try {
    const orderId = Number(req.params.id)
    const lineId  = Number(req.params.lineId)
    const parsed = patchLineSchema.safeParse({
      peso: req.body?.peso != null ? Number(req.body?.peso) : undefined,
      presentacion: req.body?.presentacion != null ? Number(req.body?.presentacion) : undefined,
    })
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })

    // validar que no se reduzca por debajo de lo ya entregado
    if (parsed.data.peso != null) {
      const delivered = await getDeliveredForLine(lineId)
      if (Number(parsed.data.peso) + 1e-9 < Number(delivered)) {
        return res.status(400).json({ error: 'No puede fijar un peso menor a lo ya entregado' })
      }
    }

    await updateOrderLine(orderId, lineId, parsed.data)
    const order = await getOrderById(orderId)
    return res.json({ ok: true, order })
  } catch (e) {
    if (e.code === 'ORDER_NOT_FOUND') return res.status(404).json({ error: 'Pedido no existe' })
    if (e.code === 'LINE_NOT_FOUND')  return res.status(404).json({ error: 'Línea no existe' })
    console.error(e)
    return res.status(500).json({ error: 'Error actualizando línea' })
  }
}

export async function deleteOrderLineCtrl(req, res) {
  try {
    const orderId = Number(req.params.id)
    const lineId  = Number(req.params.lineId)

    const delivered = await getDeliveredForLine(lineId)
    if (Number(delivered) > 0) {
      return res.status(400).json({ error: 'No puede eliminar una línea con entregas' })
    }

    await deleteOrderLine(orderId, lineId)
    const order = await getOrderById(orderId)
    return res.json({ ok: true, order })
  } catch (e) {
    if (e.code === 'ORDER_NOT_FOUND') return res.status(404).json({ error: 'Pedido no existe' })
    if (e.code === 'LINE_NOT_FOUND')  return res.status(404).json({ error: 'Línea no existe' })
    console.error(e)
    return res.status(500).json({ error: 'Error eliminando línea' })
  }
}

export async function listOrderDeliveriesAliasCtrl(req, res) {
  try {
    const { orderId } = req.params
    const data = await DeliveriesModel.listByOrder(Number(orderId))
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error listando entregas' })
  }
}
