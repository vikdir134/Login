// backend/src/routes/payments.routes.js
import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import { listPaymentsByOrder, createPayment } from '../controllers/payments.controller.js'

const router = Router()
router.use(authRequired)

router.get('/orders/:orderId/payments', requireRole(['JEFE','ADMINISTRADOR']), listPaymentsByOrder)
router.post('/orders/:orderId/payments',
  requireRole(['JEFE','ADMINISTRADOR']),
  (req, res, next) => { req.body.orderId = Number(req.params.orderId); next() },
  createPayment
)

export default router
