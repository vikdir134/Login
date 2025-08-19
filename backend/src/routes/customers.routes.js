// backend/src/routes/customers.routes.js
import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import { getCustomerDetail, listCustomers } from '../controllers/customers.controller.js'

const router = Router()

router.get('/', authRequired, requireRole(['JEFE','ADMINISTRADOR']), listCustomers)
router.get('/:id', authRequired, requireRole(['JEFE','ADMINISTRADOR']), getCustomerDetail)

export default router
