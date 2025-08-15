// src/routes/admin.routes.js
import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { getRoles, createUserAdmin } from '../controllers/users.controller.js';

const router = Router();

// Solo admins
router.use(authRequired, requireRole('ADMINISTRADOR'));

router.get('/roles', getRoles);
router.post('/users', createUserAdmin);

export default router;
