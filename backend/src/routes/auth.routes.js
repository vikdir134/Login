import { Router } from 'express';
import { register, login } from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', register);// utilizamos el register de rout
router.post('/login', login);

export default router;
