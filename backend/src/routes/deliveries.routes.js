import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { listDeliveriesByOrder, createDelivery } from '../controllers/deliveries.controller.js'

const router = Router()

// Ruta “oficial”
router.get('/order/:orderId', authRequired, listDeliveriesByOrder)
router.post('/', authRequired, createDelivery)

// Alias para compatibilidad con el front viejo:
router.get('/../orders/:orderId/deliveries', authRequired, listDeliveriesByOrder)
// o si las rutas de orders están en su router, añade ahí:
// ordersRouter.get('/:orderId/deliveries', authRequired, listDeliveriesByOrder)

export default router
