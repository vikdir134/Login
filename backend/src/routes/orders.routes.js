// src/routes/orders.routes.js
import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import {
  createOrder,
  getOrder,
  listOrdersCtrl,
  changeOrderState
} from '../controllers/orders.controller.js'

const router = Router()

// Listar / ver (muchos roles)
router.get('/', authRequired, requireRole(['ALMACENERO','PRODUCCION','JEFE','ADMINISTRADOR']), listOrdersCtrl)
router.get('/:id', authRequired, requireRole(['ALMACENERO','PRODUCCION','JEFE','ADMINISTRADOR']), getOrder)

// Crear (Producción/Jefe/Admin)
router.post('/', authRequired, requireRole(['PRODUCCION','JEFE','ADMINISTRADOR']), createOrder)

// Cambiar estado (Jefe/Admin)
router.patch('/:id/state', authRequired, requireRole(['JEFE','ADMINISTRADOR']), changeOrderState)

export default router
