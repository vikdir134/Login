// backend/src/controllers/payments.controller.js
import { z } from 'zod'
import { PaymentsModel } from '../models/payments.model.js'

const createPaymentSchema = z.object({
  orderDeliveryId: z.number().int().positive(),
  facturaId: z.number().int().positive().optional().nullable(),
  paymentDate: z.string().min(8), // YYYY-MM-DD
  amount: z.number().positive(),
  method: z.enum(['EFECTIVO','TRANSFERENCIA','TARJETA','OTRO']),
  reference: z.string().max(100).optional().nullable(),
  notes: z.string().max(200).optional().nullable(),
  currency: z.string().length(3).optional(), // default PEN
})

export async function listPaymentsByDeliveryCtrl(req, res) {
  try {
    const deliveryId = Number(req.params.deliveryId)
    if (!deliveryId) return res.status(400).json({ error: 'deliveryId inválido' })
    const data = await PaymentsModel.listByDelivery(deliveryId)
    res.json(data)
  } catch (e) {
    console.error('[listPaymentsByDelivery] error:', e)
    res.status(500).json({ error: 'Error listando pagos' })
  }
}

export async function createPaymentCtrl(req, res) {
  try {
    const parsed = createPaymentSchema.safeParse(req.body)
    if (!parsed.success) {
      const msg = parsed.error?.errors?.[0]?.message || 'Payload inválido'
      return res.status(400).json({ error: msg })
    }
    const payload = parsed.data
    const createdBy = req.user?.id ?? null
    const created = await PaymentsModel.create({ ...payload, createdBy })
    res.status(201).json(created)
  } catch (e) {
    if (e.code === 'DELIVERY_NOT_FOUND') {
      return res.status(404).json({ error: 'Entrega no encontrada', code: e.code })
    }
    console.error('[createPayment] error:', e)
    return res.status(500).json({
      error: 'Error creando pago',
      code: e.code,
      sqlMessage: e.sqlMessage
    })
  }
}
