// backend/src/routes/prices.routes.js
import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { getEffectivePriceCtrl } from '../controllers/prices.controller.js'

const router = Router()
router.get('/effective', authRequired, getEffectivePriceCtrl)

export default router
