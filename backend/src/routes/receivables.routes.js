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
router.use(authRequired, requireRole(['JEFE','ADMINISTRADOR']))

// Listado de clientes (con/sin deuda) + paginado
router.get('/customers', listCustomersWithDebtCtrl)

// Detalle de cuentas x cobrar de un cliente (por pedido)
router.get('/customers/:id', getCustomerReceivableCtrl)

// Resumen global (totales de todos los clientes)
router.get('/summary', getReceivablesSummaryCtrl)

export default router
