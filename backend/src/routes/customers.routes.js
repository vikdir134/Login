import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import {
  listCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer
} from '../controllers/customers.controller.js'

const router = Router()

// Solo JEFE y ADMINISTRADOR pueden acceder a cualquier endpoint de clientes
router.use(authRequired, requireRole('JEFE', 'ADMINISTRADOR'))

router.get('/', listCustomers)        // GET /api/customers?q=&activo=
router.get('/:id', getCustomer)       // GET /api/customers/:id
router.post('/', createCustomer)      // POST /api/customers
router.put('/:id', updateCustomer)    // PUT /api/customers/:id
router.delete('/:id', deleteCustomer) // DELETE /api/customers/:id

export default router
