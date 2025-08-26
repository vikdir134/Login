import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import {
  listDeliveriesByOrder,
  createDelivery,
  listDeliveries,
} from '../controllers/deliveries.controller.js'

const router = Router()

// Listado paginado/filtrado (la que usa Entregas.jsx)
router.get('/', authRequired, listDeliveries)

// “Entregas por pedido”
router.get('/order/:orderId', authRequired, listDeliveriesByOrder)

// Crear entrega
router.post('/', authRequired, createDelivery)

// ⚠️ Quitamos el alias roto '/../orders/:orderId/deliveries'.
// El alias oficial ya está en orders.routes: GET /api/orders/:orderId/deliveries

export default router
