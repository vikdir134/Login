// src/routes/suppliers.routes.js
import { Router } from 'express'
import { listSuppliers, createSupplier } from '../controllers/suppliers.controller.js'
import { authRequired } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'

const router = Router()
router.use(authRequired)

router.get('/suppliers',
  requireRole('ADMINISTRADOR','JEFE','PRODUCCION','ALMACENERO'),
  listSuppliers
)

router.post('/suppliers',
  requireRole('ADMINISTRADOR','JEFE'),
  createSupplier
)

export default router
