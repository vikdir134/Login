// src/routes/auth.routes.js
import { Router } from 'express';
import { register, login } from '../controllers/auth.controller.js';

const router = Router();

/** ⚠️ Público temporal (eliminar cuando uses solo admin) */
router.post('/register', register);

router.post('/login', login);

export default router;
