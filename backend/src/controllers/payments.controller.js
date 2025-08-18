import { z } from 'zod'
import { PaymentsModel } from '../models/payments.model.js'

const createPaymentSchema = z.object({
  orderId: z.number().int().positive(),
  paymentDate: z.string().min(8), // 'YYYY-MM-DD'
  amount: z.number().positive(),
  method: z.enum(['EFECTIVO','TRANSFERENCIA','TARJETA','OTRO']),
  reference: z.string().max(100).optional().nullable(),
  notes: z.string().max(200).optional().nullable(),
  currency: z.string().length(3).optional() // default PEN
})

export async function listPaymentsByOrder(req, res) {
  try {
    const { orderId } = req.params
    const data = await PaymentsModel.listByOrder(Number(orderId))
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error listando pagos' })
  }
}

export async function createPayment(req, res) {
  try {
    const parsed = createPaymentSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })

    const payload = parsed.data
    const createdBy = req.user?.id ?? null
    const created = await PaymentsModel.create({ ...payload, createdBy })
    res.status(201).json(created)
  } catch (e) {
    console.error('createPayment error:', e);         // <- deja esto
    return res.status(500).json({
      error: 'Error creando pago',
      code: e.code,
      sqlMessage: e.sqlMessage
    });
  }
}
