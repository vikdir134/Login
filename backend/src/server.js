// src/server.js
import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import authRouter from './routes/auth.routes.js';
import adminRouter from './routes/admin.routes.js';
import { authRequired } from './middleware/auth.js';

const app = express();

const allowed = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: allowed }));

app.use(express.json());

app.get('/', (_req, res) => res.send('API OK'));

// Auth
app.use('/api/auth', authRouter);

// Admin-only
app.use('/api/admin', adminRouter);

// Ejemplo protegido (cualquiera logueado)
app.get('/api/secure/hello', authRequired, (req, res) => {
  res.json({ message: `Hola ${req.user.email} (${req.user.role})` });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend escuchando en http://localhost:${PORT}`);
});
