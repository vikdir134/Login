// backend/src/routes/customers.routes.js
import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import { getCustomerDetail, listCustomers, createCustomer,getCustomerSummary } from '../controllers/customers.controller.js'

const router = Router()

// Si tu requireRole acepta array:
router.get('/',    authRequired, requireRole(['JEFE','ADMINISTRADOR']), listCustomers)
router.get('/:id', authRequired, requireRole(['JEFE','ADMINISTRADOR']), getCustomerDetail)

// === NUEVO: crear cliente (ADMINISTRADOR o JEFE)
router.post('/',   authRequired, requireRole(['JEFE','ADMINISTRADOR']), createCustomer)
router.get('/:id/summary',
  authRequired,
  requireRole(['JEFE','ADMINISTRADOR']),
  getCustomerSummary
)

// Si tu requireRole fuese variádico, usa:
// requireRole('JEFE','ADMINISTRADOR')

export default router
