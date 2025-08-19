import { Router } from 'express'
import { listPurchases, createPurchase } from '../controllers/purchases.controller.js'
import { authRequired } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'

const router = Router()
router.use(authRequired)

router.get('/purchases',
  requireRole('ADMINISTRADOR','JEFE','PRODUCCION'),
  listPurchases
)

router.post('/purchases',
  requireRole('ADMINISTRADOR','JEFE'),
  createPurchase
)

export default router
