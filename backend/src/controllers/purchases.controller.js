import { z } from 'zod'
import { PurchasesModel } from '../models/purchases.model.js'

const itemSchema = z.object({
  primaterId: z.number().int().positive(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  totalPrice: z.number().nonnegative().optional(),
  notes: z.string().max(255).optional().nullable()
})

const headerSchema = z.object({
  supplierId: z.number().int().positive(),
  documentType: z.enum(['FACTURA','BOLETA','GUIA','OTRO']),
  documentNumber: z.string().min(1).max(50),
  documentDate: z.string().min(8), // 'YYYY-MM-DD'
  totalNet: z.number().nonnegative(),
  taxAmount: z.number().nonnegative(),
  totalAmount: z.number().nonnegative(),
  currency: z.string().length(3).optional(),
  notes: z.string().max(255).optional().nullable()
})

export async function listPurchases(req, res) {
  try {
    const { from, to, supplierId } = req.query
    const data = await PurchasesModel.list({ from, to, supplierId })
    res.json(data)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error listando compras' })
  }
}

export async function getPurchase(req, res) {
  try {
    const one = await PurchasesModel.get(req.params.id)
    if (!one) return res.status(404).json({ error: 'Compra no encontrada' })
    res.json(one)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error obteniendo compra' })
  }
}

export async function createPurchase(req, res) {
  try {
    const body = req.body
    const headerParse = headerSchema.safeParse(body.header)
    if (!headerParse.success) return res.status(400).json({ error: headerParse.error.errors[0].message })

    const itemsParse = z.array(itemSchema).nonempty().safeParse(body.items)
    if (!itemsParse.success) return res.status(400).json({ error: itemsParse.error.errors[0].message })

    const createdBy = req.user?.id ?? null
    const created = await PurchasesModel.create({ header: headerParse.data, items: itemsParse.data, createdBy })
    res.status(201).json(created)
  } catch (e) {
    console.error(e)
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Documento duplicado para este proveedor' })
    res.status(500).json({ error: 'Error creando compra' })
  }
}
