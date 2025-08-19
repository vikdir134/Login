// backend/src/controllers/customers.controller.js
import {
  findCustomerById,
  listCustomersBasic,
  listOrdersByCustomer
} from '../models/customers.model.js'

export async function listCustomers(req, res) {
  try {
    const { q, limit = 50 } = req.query
    const rows = await listCustomersBasic({ q, limit: Number(limit) })
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error listando clientes' })
  }
}

export async function getCustomerDetail(req, res) {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'ID inválido' })

    const customer = await findCustomerById(id)
    if (!customer) return res.status(404).json({ error: 'Cliente no existe' })

    const orders = await listOrdersByCustomer(id)
    res.json({ customer, orders })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error obteniendo detalle de cliente' })
  }
}
