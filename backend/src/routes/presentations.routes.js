// src/routes/presentations.routes.js
import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import {
  listPresentationsCtrl,
  createPresentationCtrl
} from '../controllers/presentations.controller.js'

const router = Router()

// Listar presentaciones de un producto
router.get('/product-presentations/:productId', authRequired, listPresentationsCtrl)

// Crear presentación (limítalo a JEFE/ADMIN si quieres)
router.post(
  '/product-presentations',
  authRequired,
  requireRole(['JEFE', 'ADMINISTRADOR']),
  createPresentationCtrl
)

export default router
