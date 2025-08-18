import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import {
  listOrdersByCustomer,
  getOrderOverview,
  getOrderPayments,
  getOrderDeliveries
} from '../controllers/orders.controller.js'

const router = Router()
router.use(authRequired)

// Pedidos del cliente: PRODUCCION / JEFE / ADMIN
router.get(
  '/customers/:customerId/orders',
  requireRole('PRODUCCION','JEFE','ADMINISTRADOR'),
  listOrdersByCustomer
)

// Overview del pedido: PRODUCCION / JEFE / ADMIN
router.get(
  '/orders/:id/overview',
  requireRole('PRODUCCION','JEFE','ADMINISTRADOR'),
  getOrderOverview
)

// Pagos: solo JEFE / ADMIN
router.get(
  '/orders/:id/payments',
  requireRole('JEFE','ADMINISTRADOR'),
  getOrderPayments
)

// Entregas: PRODUCCION / JEFE / ADMIN
router.get(
  '/orders/:id/deliveries',
  requireRole('PRODUCCION','JEFE','ADMINISTRADOR'),
  getOrderDeliveries
)

export default router
