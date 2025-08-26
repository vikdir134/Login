// src/routes/almacen.routes.js
import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import * as almacen from '../controllers/almacen.controller.js'

const r = Router()

// Zonas y catálogo simple
r.get('/spaces', authRequired, almacen.listSpaces)

// ==== PRODUCTO TERMINADO ====
// stock agregados por producto + zona (compatibilidad con front actual)
r.get('/pt/stock', authRequired, almacen.listPtStock)

// NUEVO: overview → totales por producto + detalle por presentación
r.get('/pt/stock/overview', authRequired, almacen.listPtStockOverview)

// ingresar PT a una zona (ej: PT_ALMACEN); acepta presentationId (opcional)
r.post('/pt/ingreso', authRequired, almacen.ptIngreso)

// traslado PT entre zonas; acepta presentationId (opcional)
// si se especifica, valida stock y traslada solo esa presentación
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
