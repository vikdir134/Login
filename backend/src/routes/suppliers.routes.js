import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import {
  listSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier
} from '../controllers/suppliers.controller.js'

const router = Router()

router.use(authRequired, requireRole('ALMACENERO','JEFE','ADMINISTRADOR'))

router.get('/', listSuppliers)
router.get('/:id', getSupplier)
router.post('/', createSupplier)
router.put('/:id', updateSupplier)
router.delete('/:id', deleteSupplier)

export default router
