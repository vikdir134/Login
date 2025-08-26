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
  listOrdersInProcessCtrl,
  listOrdersCombinedCtrl,   // (si lo usas en otro lado)
  searchOrdersCtrl
} from '../controllers/orders.controller.js'
import {
  addOrderLineCtrl,
  updateOrderLineCtrl,
  deleteOrderLineCtrl,
  listOrderDeliveriesAliasCtrl,
} from '../controllers/orders.lines.controller.js'

const router = Router()

// 🔹 Las rutas MÁS específicas van primero (antes de '/:id')

// Búsqueda combinada por estados CSV (PENDIENTE,EN_PROCESO)
router.get(
  '/search',
  authRequired,
  requireRole(['ALMACENERO','PRODUCCION','JEFE','ADMINISTRADOR']),
  searchOrdersCtrl
)

// En proceso (si aún la usas)
router.get(
  '/in-process',
  authRequired,
  requireRole(['ALMACENERO','PRODUCCION','JEFE','ADMINISTRADOR']),
  listOrdersInProcessCtrl
)

// Listar colección general (con filtros)
router.get(
  '/',
  authRequired,
  requireRole(['ALMACENERO','PRODUCCION','JEFE','ADMINISTRADOR']),
  listOrdersCtrl
)

// Líneas del pedido
router.get(
  '/:orderId/deliveries',
  authRequired,
  listOrderDeliveriesAliasCtrl
)
router.post(
  '/:id/lines',
  authRequired,
  requireRole(['PRODUCCION','JEFE','ADMINISTRADOR']),
  addOrderLineCtrl
)
router.patch(
  '/:id/lines/:lineId',
  authRequired,
  requireRole(['PRODUCCION','JEFE','ADMINISTRADOR']),
  updateOrderLineCtrl
)
router.delete(
  '/:id/lines/:lineId',
  authRequired,
  requireRole(['PRODUCCION','JEFE','ADMINISTRADOR']),
  deleteOrderLineCtrl
)

// Detalle por id (ESTA SIEMPRE AL FINAL)
router.get(
  '/:id',
  authRequired,
  requireRole(['ALMACENERO','PRODUCCION','JEFE','ADMINISTRADOR']),
  getOrder
)

// Crear / cambiar estado / cancelar / reactivar
router.post(
  '/',
  authRequired,
  requireRole(['PRODUCCION','JEFE','ADMINISTRADOR']),
  createOrder
)
router.patch(
  '/:id/state',
  authRequired,
  requireRole(['JEFE','ADMINISTRADOR']),
  changeOrderState
)
router.post(
  '/:id/cancel',
  authRequired,
  requireRole(['JEFE','ADMINISTRADOR']),
  cancelOrderCtrl
)
router.post(
  '/:id/reactivate',
  authRequired,
  requireRole(['JEFE','ADMINISTRADOR']),
  reactivateOrderCtrl
)

export default router
