import { Router } from 'express';
import { register, login } from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', register);// utilizamos el register del auth.controlador
router.post('/login', login);// utilizamos el login del auth.controlador

export default router;
