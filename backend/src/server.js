// backend/src/server.js
import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import authRouter from './routes/auth.routes.js';
import adminRouter from './routes/admin.routes.js';
import customersRouter from './routes/customers.routes.js';
import suppliersRouter from './routes/suppliers.routes.js'
import purchasesRouter from './routes/purchases.routes.js'
import { authRequired } from './middleware/auth.js';
import { testConnection } from './db.js';
import ordersRouter from './routes/orders.routes.js'
import paymentsRouter from './routes/payments.routes.js'
import deliveriesRouter from './routes/deliveries.routes.js'

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.get('/', (_req, res) => res.send('API OK'));

// Rutas
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/customers', customersRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/purchases', purchasesRouter);
app.use('/api', ordersRouter);
app.use('/api', paymentsRouter)
app.use('/api', deliveriesRouter)


// Ejemplo protegido
app.get('/api/secure/hello', authRequired, (req, res) => {
  res.json({ message: `Hola ${req.user.email}` });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, async () => {
  try {
    const ok = await testConnection();
    console.log(ok
      ? `DB conectada → ${process.env.DB_NAME}`
      : 'No se pudo verificar la conexión DB');
  } catch (e) {
    console.error('Error conectando a la DB:', e?.code || e?.message);
  }
  console.log(`Backend escuchando en http://localhost:${PORT}`);
});
