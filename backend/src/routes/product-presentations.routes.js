// src/routes/product-presentations.routes.js
import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js' // si lo tienes
import { createPresentationCtrl, listPresentationsCtrl } from '../controllers/presentations.controller.js'

const router = Router()

// Crear presentación: limita a JEFE/ADMIN (ajusta roles si quieres)
router.post(
  '/product-presentations',
  authRequired,
  requireRole(['JEFE','ADMINISTRADOR']),
  createPresentationCtrl
)

// Listar presentaciones (cualquier rol autenticado)
router.get(
  '/product-presentations',
  authRequired,
  listPresentationsCtrl
)

export default router
