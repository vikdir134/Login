import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import {
  createOrder,
  getOrder,
  listOrdersCtrl,
  changeOrderState,
  cancelOrderCtrl,
  reactivateOrderCtrl,
  listOrdersInProcessCtrl
} from '../controllers/orders.controller.js'
import {
  addOrderLineCtrl,
  updateOrderLineCtrl,
  deleteOrderLineCtrl,
  listOrderDeliveriesAliasCtrl,
} from '../controllers/orders.lines.controller.js'

const router = Router()

// Listar (colección)
router.get(
  '/',
  authRequired,
  requireRole(['ALMACENERO','PRODUCCION','JEFE','ADMINISTRADOR']),
  listOrdersCtrl
)

// Rutas más específicas ANTES de '/:id'
router.get(
  '/in-process',
  authRequired,
  requireRole(['ALMACENERO','PRODUCCION','JEFE','ADMINISTRADOR']),
  listOrdersInProcessCtrl
)
router.get(
  '/:orderId/deliveries',
  authRequired,
  listOrderDeliveriesAliasCtrl
)

// Detalle por id (después de las específicas)
router.get('/:id', authRequired, requireRole(['ALMACENERO','PRODUCCION','JEFE','ADMINISTRADOR']), getOrder)

// Crear
router.post(
  '/',
  authRequired,
  requireRole(['PRODUCCION','JEFE','ADMINISTRADOR']),
  createOrder
)

// Cambiar estado directo
router.patch(
  '/:id/state',
  authRequired,
  requireRole(['JEFE','ADMINISTRADOR']),
  changeOrderState
)

// Cancelar / Reactivar
router.post('/:id/cancel',     authRequired, requireRole(['JEFE','ADMINISTRADOR']), cancelOrderCtrl)
router.post('/:id/reactivate', authRequired, requireRole(['JEFE','ADMINISTRADOR']), reactivateOrderCtrl)

// Líneas
router.post('/:id/lines',            authRequired, requireRole(['PRODUCCION','JEFE','ADMINISTRADOR']), addOrderLineCtrl)
router.patch('/:id/lines/:lineId',   authRequired, requireRole(['PRODUCCION','JEFE','ADMINISTRADOR']), updateOrderLineCtrl)
router.delete('/:id/lines/:lineId',  authRequired, requireRole(['PRODUCCION','JEFE','ADMINISTRADOR']), deleteOrderLineCtrl)

export default router
