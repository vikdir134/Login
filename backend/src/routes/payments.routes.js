// backend/src/routes/payments.routes.js
import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import {
  listPaymentsByDeliveryCtrl,
  createPaymentCtrl,
} from '../controllers/payments.controller.js'

const router = Router()

// Requiere login + rol
router.use(authRequired, requireRole(['JEFE','ADMINISTRADOR']))

// Historial por ENTREGA
router.get('/deliveries/:deliveryId/payments', listPaymentsByDeliveryCtrl)

// Crear pago POR ENTREGA
router.post(
  '/deliveries/:deliveryId/payments',
  (req, _res, next) => { req.body.orderDeliveryId = Number(req.params.deliveryId); next() },
  createPaymentCtrl
)

export default router
