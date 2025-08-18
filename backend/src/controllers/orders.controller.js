import { OrdersModel } from '../models/orders.model.js'

export async function listOrdersByCustomer(req, res) {
  try {
    const { customerId } = req.params
    const data = await OrdersModel.listByCustomer(customerId)
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error listando pedidos del cliente' })
  }
}

export async function getOrderOverview(req, res) {
  try {
    const { id } = req.params
    const data = await OrdersModel.getOverview(id)
    if (!data) return res.status(404).json({ error: 'Pedido no encontrado' })
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error obteniendo resumen del pedido' })
  }
}

export async function getOrderPayments(req, res) {
  try {
    const { id } = req.params
    const data = await OrdersModel.listPayments(id)
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error listando pagos del pedido' })
  }
}

export async function getOrderDeliveries(req, res) {
  try {
    const { id } = req.params
    const data = await OrdersModel.listDeliveries(id)
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error listando entregas del pedido' })
  }
}
