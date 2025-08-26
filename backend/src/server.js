// backend/src/server.js
import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import authRouter from './routes/auth.routes.js';
import adminRouter from './routes/admin.routes.js';
import { authRequired } from './middleware/auth.js';
import { testConnection } from './db.js';
import { zonesRouter } from './routes/zones.routes.js'
import { colorsRouter } from './routes/colors.routes.js'
import { materialsRouter } from './routes/materials.routes.js'
import { primaryMaterialsRouter } from './routes/primary-materials.routes.js'
import { productsRouter } from './routes/products.routes.js'
import { stockRouter } from './routes/stock.routes.js'
import deliveriesRouter from './routes/deliveries.routes.js'
import paymentsRouter from './routes/payments.routes.js'
import customersRouter from './routes/customers.routes.js'
import ordersRouter from './routes/orders.routes.js'
import suppliersRouter from './routes/suppliers.routes.js'
import purchasesRouter from './routes/purchases.routes.js'
import presentationsRouter from './routes/presentations.routes.js'
import almacenRouter from './routes/almacen.routes.js'
import catalogRouter from './routes/catalog.routes.js'
import productPresentationsRouter from './routes/product-presentations.routes.js'
import mermaRouter from './routes/merma.routes.js'
import { finishedInputRouter } from './routes/finished-input.routes.js'
import pricesRouter from './routes/prices.routes.js'

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.get('/', (_req, res) => res.send('API OK'));

// Rutas
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/customers', customersRouter)
app.use('/api', suppliersRouter)
app.use('/api', purchasesRouter)
app.use('/api/orders', ordersRouter)
app.use('/api', paymentsRouter)
app.use('/api/zones', zonesRouter)
app.use('/api/colors', colorsRouter)
app.use('/api/materials', materialsRouter)
app.use('/api/primary-materials', primaryMaterialsRouter)
app.use('/api/products', productsRouter)
app.use('/api/stock', stockRouter)
app.use('/api/deliveries', deliveriesRouter)
app.use('/api', catalogRouter)
app.use('/api/almacen', almacenRouter)
app.use('/api/stock/finished', finishedInputRouter)
app.use('/api', presentationsRouter)
app.use('/api', productPresentationsRouter)
app.use('/api', mermaRouter)
app.use('/api/prices', pricesRouter)
// al final de tu configuración de Express
app.use((err, req, res, next) => {
  console.error('[GLOBAL ERROR]', err)
  const isDev = process.env.NODE_ENV !== 'production'
  res.status(err.status || 500).json({
    error: err.publicMessage || 'Error del servidor',
    code: err.code || 'UNHANDLED',
    ...(isDev ? { message: err.message, stack: err.stack } : {})
  })
})


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
