// backend/src/routes/receivables.routes.js
import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import {
  listCustomersWithDebtCtrl,
  getCustomerReceivableCtrl,
  getReceivablesSummaryCtrl,
} from '../controllers/receivables.controller.js'

const router = Router()

// protección global para todas las rutas del módulo
router.use(authRequired, requireRole(['JEFE','ADMINISTRADOR']))

// Listado de clientes (con/sin deuda) + paginado
// GET /api/receivables/customers
router.get('/customers', listCustomersWithDebtCtrl)

// Detalle CxC por cliente (¡ojo! path y param name que espera el frontend)
// GET /api/receivables/customers/:customerId
router.get('/customers/:customerId', getCustomerReceivableCtrl)

// Resumen global de CxC
// GET /api/receivables/summary
router.get('/summary', getReceivablesSummaryCtrl)

export default router
