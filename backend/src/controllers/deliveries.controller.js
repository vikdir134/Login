import { z } from 'zod'
import { DeliveriesModel } from '../models/deliveries.model.js'

const lineSchema = z.object({
  descriptionOrderId: z.number().int().positive(),
  peso: z.number().positive(),
  descripcion: z.string().max(50).optional().nullable(),
  unitPrice: z.number().nonnegative().optional().nullable()
})

// ⚠️ fecha ahora ES OPCIONAL (dejamos que el servidor ponga NOW() si no envías nada)
const createDeliverySchema = z.object({
  orderId: z.number().int().positive(),
  facturaId: z.number().int().positive().optional().nullable(),
  fecha: z.string().min(8).optional().nullable(), // 'YYYY-MM-DD' o 'YYYY-MM-DD hh:mm:ss'
  lines: z.array(lineSchema).nonempty()
})

export async function createDelivery(req, res) {
  try {
    const parsed = createDeliverySchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })

    const createdBy = req.user?.id ?? null
    const created = await DeliveriesModel.create({ ...parsed.data, createdBy })
    res.status(201).json(created)
  } catch (e) {
    console.error(e)
    if (e.code === 'ORDER_NOT_FOUND')     return res.status(404).json({ error: 'Pedido no existe' })
    if (e.code === 'ORDER_LINE_INVALID')  return res.status(400).json({ error: 'Línea de pedido inválida' })
    if (e.code === 'ALREADY_FULFILLED')   return res.status(400).json({ error: 'Esta línea ya está completamente entregada' })
    if (e.code === 'OVER_DELIVERY')       return res.status(400).json({ error: e.message, remaining: e.remaining })
    if (e.code === 'NO_EFFECTIVE_PRICE')  return res.status(400).json({ error: 'No hay precio vigente para esta línea y fecha' })
    res.status(500).json({ error: 'Error creando entrega' })
  }
}

export async function listDeliveriesByOrder(req, res) {
  try {
    const { orderId } = req.params
    const data = await DeliveriesModel.listByOrder(Number(orderId))
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error listando entregas' })
  }
}
