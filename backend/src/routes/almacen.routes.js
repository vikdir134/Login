// src/routes/almacen.routes.js
import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import * as almacen from '../controllers/almacen.controller.js'

const r = Router()

// Zonas y catálogo simple
r.get('/spaces', authRequired, almacen.listSpaces)

// ==== PRODUCTO TERMINADO ====
// stock agregados por producto + zona
r.get('/pt/stock', authRequired, almacen.listPtStock)

// ingresar PT a una zona (ej: PT_ALMACEN)
r.post('/pt/ingreso', authRequired, almacen.ptIngreso)

// traslado PT entre zonas
r.post('/pt/traslado', authRequired, almacen.ptTraslado)

// borrar movimiento PT solo si es en MERMA (regla negocio)
r.delete('/pt/mov/:id', authRequired, almacen.ptDeleteMermaOnly)

// ==== MATERIA PRIMA (MP) ====
// stock agregados por MP + zona
r.get('/mp/stock', authRequired, almacen.listMpStock)

// ingresar MP a una zona
r.post('/mp/ingreso', authRequired, almacen.mpIngreso)

// traslado MP entre zonas
r.post('/mp/traslado', authRequired, almacen.mpTraslado)

// borrar movimiento MP solo si es en MERMA
r.delete('/mp/mov/:id', authRequired, almacen.mpDeleteMermaOnly)

export default r
