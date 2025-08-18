// src/controllers/deliveries.controller.js
import { z } from 'zod'
import { DeliveriesModel } from '../models/deliveries.model.js'

const lineSchema = z.object({
  descriptionOrderId: z.coerce.number().int().positive(),
  peso: z.coerce.number().positive(),
  descripcion: z.string().max(50).optional().nullable(),
  // si no viene, el modelo buscará precio vigente
  unitPrice: z.coerce.number().nonnegative().optional().nullable()
})

const createDeliverySchema = z.object({
  // lo setearás desde params si viene, pero igual validamos
  orderId: z.coerce.number().int().positive(),
  facturaId: z.coerce.number().int().positive().optional().nullable(),
  fecha: z.string().trim().min(8), // 'YYYY-MM-DD' o 'YYYY-MM-DD hh:mm:ss'
  lines: z.array(lineSchema).nonempty()
})

export async function createDelivery(req, res) {
  try {
    // Prioriza orderId de la URL (si existe)
    const orderIdFromParams = req.params?.orderId
    const input = { ...req.body }
    if (orderIdFromParams !== undefined) input.orderId = orderIdFromParams

    const parsed = createDeliverySchema.safeParse(input)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message })
    }

    const createdBy = req.user?.id ?? null
    const created = await DeliveriesModel.create({ ...parsed.data, createdBy })
    return res.status(201).json(created)
  } catch (e) {
    console.error(e)
    if (e.code === 'ORDER_NOT_FOUND')    return res.status(404).json({ error: 'Pedido no existe' })
    if (e.code === 'ORDER_LINE_INVALID') return res.status(400).json({ error: 'Línea de pedido inválida' })
    if (e.code === 'NO_EFFECTIVE_PRICE') return res.status(400).json({ error: 'No hay precio vigente para esta línea y fecha' })
    return res.status(500).json({ error: 'Error creando entrega' })
  }
}

export async function listDeliveriesByOrder(req, res) {
  try {
    const orderId = Number(req.params.orderId)
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ error: 'orderId inválido' })
    }
    const data = await DeliveriesModel.listByOrder(orderId)
    return res.json(data)
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Error listando entregas' })
  }
}
