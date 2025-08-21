import { PurchasesModel } from '../models/purchases.model.js'

export async function createPurchaseCtrl(req, res) {
  try {
    const userId = req.user?.id ?? null
    const data = await PurchasesModel.create({ ...req.body, createdBy: userId })
    res.status(201).json(data)
  } catch (e) {
    const code = e.code || 'CREATE_ERROR'
    res.status(400).json({ error: e.message || 'Error creando compra', code })
  }
}

export async function listPurchasesCtrl(req, res) {
  try {
    const data = await PurchasesModel.list(req.query)
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: 'Error listando compras' })
  }
}

export async function getPurchaseCtrl(req, res) {
  try {
    const { id } = req.params
    const data = await PurchasesModel.getById(Number(id))
    if (!data) return res.status(404).json({ error: 'Compra no encontrada' })
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: 'Error obteniendo compra' })
  }
}
