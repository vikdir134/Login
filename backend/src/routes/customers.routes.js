import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import { listCustomers, createCustomer, getCustomerSummary } from '../controllers/customers.controller.js'

const router = Router()
router.use(authRequired)

router.get('/customers',
  requireRole('JEFE','ADMINISTRADOR','PRODUCCION','ALMACENERO'),
  listCustomers
)

router.post('/customers',
  requireRole('JEFE','ADMINISTRADOR'),
  createCustomer
)

router.get('/customers/:id',
  requireRole('JEFE','ADMINISTRADOR','PRODUCCION'),
  getCustomerSummary
)

export default router
