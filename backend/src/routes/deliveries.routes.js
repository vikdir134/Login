import { Router } from 'express'
import { createDelivery, listDeliveriesByOrder } from '../controllers/deliveries.controller.js'
import { authRequired } from '../middleware/auth.js'        // <- ruta correcta (singular)
import { requireRole } from '../middleware/roles.js'        // <- si ya lo tienes

const router = Router()

// Crear entrega para un pedido (PRODUCCION/JEFE/ADMINISTRADOR)
router.post(
  '/orders/:orderId/deliveries',
  authRequired,
  requireRole('PRODUCCION', 'JEFE', 'ADMINISTRADOR'),
  (req, _res, next) => { req.body.orderId = Number(req.params.orderId); next() },
  createDelivery
)

// Listar entregas de un pedido (PRODUCCION/JEFE/ADMINISTRADOR)
router.get(
  '/orders/:orderId/deliveries',
  authRequired,
  requireRole('PRODUCCION', 'JEFE', 'ADMINISTRADOR'),
  listDeliveriesByOrder
)

export default router
