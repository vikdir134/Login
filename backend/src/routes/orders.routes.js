import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import { listOrders, getOrder, createOrder } from '../controllers/orders.controller.js'

const router = Router()
router.use(authRequired)

router.get('/orders',
  requireRole('JEFE','ADMINISTRADOR','PRODUCCION','ALMACENERO'),
  listOrders
)

router.get('/orders/:id',
  requireRole('JEFE','ADMINISTRADOR','PRODUCCION','ALMACENERO'),
  getOrder
)

router.post('/orders',
  requireRole('JEFE','ADMINISTRADOR','PRODUCCION'),
  createOrder
)

export default router
