// src/routes/orders.routes.js
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
} from '../controllers/orders.controller.js'
import {
  addOrderLineCtrl,
  updateOrderLineCtrl,
  deleteOrderLineCtrl,
  listOrderDeliveriesAliasCtrl,
} from '../controllers/orders.lines.controller.js'

const router = Router()

// Listar / ver
router.get('/', authRequired, requireRole(['ALMACENERO','PRODUCCION','JEFE','ADMINISTRADOR']), listOrdersCtrl)
router.get('/:id', authRequired, requireRole(['ALMACENERO','PRODUCCION','JEFE','ADMINISTRADOR']), getOrder)

// Crear
router.post('/', authRequired, requireRole(['PRODUCCION','JEFE','ADMINISTRADOR']), createOrder)

// Cambiar estado directo (si lo quieres mantener)
router.patch('/:id/state', authRequired, requireRole(['JEFE','ADMINISTRADOR']), changeOrderState)

// NUEVO: cancelar / reactivar (recalcula estado real al reactivar)
router.post('/:id/cancel', authRequired, requireRole(['JEFE','ADMINISTRADOR']), cancelOrderCtrl)
router.post('/:id/reactivate', authRequired, requireRole(['JEFE','ADMINISTRADOR']), reactivateOrderCtrl)

// NUEVO: CRUD de líneas
router.post('/:id/lines', authRequired, requireRole(['PRODUCCION','JEFE','ADMINISTRADOR']), addOrderLineCtrl)
router.patch('/:id/lines/:lineId', authRequired, requireRole(['PRODUCCION','JEFE','ADMINISTRADOR']), updateOrderLineCtrl)
router.delete('/:id/lines/:lineId', authRequired, requireRole(['PRODUCCION','JEFE','ADMINISTRADOR']), deleteOrderLineCtrl)

// Alias de entregas para el front
router.get('/:orderId/deliveries', authRequired, listOrderDeliveriesAliasCtrl)

export default router
