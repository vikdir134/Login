import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import { listPurchases, getPurchase, createPurchase } from '../controllers/purchases.controller.js'

const router = Router()

router.use(authRequired, requireRole('ALMACENERO','JEFE','ADMINISTRADOR'))

router.get('/', listPurchases)   // filtros: ?from=YYYY-MM-DD&to=YYYY-MM-DD&supplierId=#
router.get('/:id', getPurchase)
router.post('/', createPurchase) // body: { header:{...}, items:[...] }

export default router
