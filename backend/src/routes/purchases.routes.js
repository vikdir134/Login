import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import { createPurchaseCtrl, listPurchasesCtrl,getPurchaseCtrl } from '../controllers/purchases.controller.js'
import { normalizePurchase } from '../middleware/normalize-purchase.js'

const router = Router()

router.get(
  '/purchases',
  authRequired,
  requireRole(['ALMACENERO', 'JEFE', 'ADMINISTRADOR']),
  listPurchasesCtrl
)
router.get('/purchases/:id', authRequired, getPurchaseCtrl)
router.post(
  '/purchases',
  authRequired,
  requireRole(['ALMACENERO', 'JEFE', 'ADMINISTRADOR']),
  normalizePurchase,           // <-- aquí
  createPurchaseCtrl
)

export default router
