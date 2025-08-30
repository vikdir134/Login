// backend/src/controllers/customers.controller.js
import {
  findCustomerById,
  listCustomersBasic,
  listOrdersByCustomer,
  createCustomerBasic,
  getCustomerKPIs,
  // 👇 nombre correcto (con "Orders" y con "s" al final)
  listCustomerOrdersWithTotals
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

export async function getCustomerSummary(req, res) {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'ID inválido' })

    const customer = await findCustomerById(id)
    if (!customer) return res.status(404).json({ error: 'Cliente no existe' })

    // filtros
    const csv = String(req.query.states || '').trim()
    const states = csv ? csv.split(',').map(s => s.trim()).filter(Boolean) : undefined
    const from   = req.query.from || undefined  // YYYY-MM-DD
    const to     = req.query.to   || undefined  // YYYY-MM-DD
    const limit  = Math.min(Number(req.query.limit)  || 10, 100)
    const offset = Math.max(Number(req.query.offset) || 0, 0)

    const kpis   = await getCustomerKPIs({ customerId: id, states, from, to })
    const orders = await listCustomerOrdersWithTotals({ customerId: id, states, from, to, limit, offset })

    return res.json({ customer, kpis, orders })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error obteniendo resumen de cliente' })
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

export async function createCustomer(req, res) {
  try {
    const { RUC, razonSocial, activo = true } = req.body
    const cli = await createCustomerBasic({ RUC, razonSocial, activo })
    res.status(201).json(cli)
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'RUC o Razón social ya registrados' })
    }
    if (e.code === 'BAD_INPUT') {
      return res.status(400).json({ error: e.message })
    }
    console.error(e)
    res.status(500).json({ error: 'Error creando cliente' })
  }
}
