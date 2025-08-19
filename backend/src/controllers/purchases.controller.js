import { z } from 'zod'
import { PurchasesModel } from '../models/purchases.model.js'

const itemSchema = z.object({
  primaryMaterialId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().positive(),
  notes: z.string().max(200).optional().nullable()
})

const createSchema = z.object({
  supplierId: z.coerce.number().int().positive(),
  documentType: z.enum(['FACTURA','BOLETA','GUIA','OTRO']),
  documentNumber: z.string().min(1).max(50),
  documentDate: z.string().min(8), // YYYY-MM-DD
  currency: z.string().length(3).default('PEN'),
  notes: z.string().max(255).optional().nullable(),
  items: z.array(itemSchema).nonempty()
})

export async function listPurchases(req, res) {
  try {
    const supplierId = req.query.supplierId ? Number(req.query.supplierId) : null
    const from = req.query.from || null
    const to = req.query.to || null
    const limit = Number(req.query.limit || 50)
    const offset = Number(req.query.offset || 0)
    const rows = await PurchasesModel.list({ supplierId, from, to, limit, offset })
    res.json(rows)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error listando compras' })
  }
}

export async function createPurchase(req, res) {
  try {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })
    const createdBy = req.user?.id ?? null
    const purchase = await PurchasesModel.create({ ...parsed.data, createdBy })
    res.status(201).json(purchase)
  } catch (e) {
    console.error(e)
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Documento de compra ya existe (tipo + número)' })
    }
    res.status(500).json({ error: 'Error creando compra' })
  }
}
