import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import authRouter from './routes/auth.routes.js';
import { authRequired } from './middleware/auth.js';

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.get('/', (_req, res) => res.send('API OK'));

// Rutas MVC
app.use('/api/auth', authRouter);

// Ejemplo de ruta protegida
app.get('/api/secure/hello', authRequired, (req, res) => {
  res.json({ message: `Hola ${req.user.email}` });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend escuchando en http://localhost:${PORT}`);
});
