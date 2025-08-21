// src/api/almacen.js
import api from './axios'

/**
 * === Productos Terminados en Almacén ===
 * GET /api/stock/finished?limit&offset&q
 * Respuesta: { items: [{ id, ID_PRO, ID_PRODUCT, productName, PRESENTATION_KG, PESO, FECHA }], totalCount }
 */
export async function listPTInZone({ limit=30, offset=0, q } = {}) {
  const { data } = await api.get('/api/stock/finished', { params: { limit, offset, q } })
  return data
}

/**
 * === MP por Zona (RECEPCION | PRODUCCION) ===
 * GET /api/stock/primary?zone=RECEPCION|PRODUCCION&limit&offset&q
 * Respuesta: { items: [{ ID_PRIMATER, materialName, PESO, FECHA }], totalCount }
 */
export async function listPMInZone({ zone='RECEPCION', limit=30, offset=0, q } = {}) {
  const { data } = await api.get('/api/stock/primary', { params: { zone, limit, offset, q } })
  return data
}

/**
 * === Merma (historial paginado) ===
 * GET /api/stock/merma?limit&offset&q
 * Respuesta: { items: [{ id, DESCRIPCION, CANTIDAD, FECHA }], totalCount }
 */
export async function listMerma({ limit=30, offset=0, q } = {}) {
  const { data } = await api.get('/api/stock/merma', { params: { limit, offset, q } })
  return data
}

/**
 * POST /api/stock/merma
 * body: { quantity, description, primaterId }
 */
export async function createMerma(payload) {
  const { data } = await api.post('/api/stock/merma', payload)
  return data
}

/**
 * DELETE /api/stock/merma/:id
 */
export async function deleteMerma(id) {
  const { data } = await api.delete(`/api/stock/merma/${id}`)
  return data
}

/**
 * === Extras ===
 * POST /api/materials        -> { descripcion }
 * POST /api/colors           -> { descripcion }
 * POST /api/product-presentations -> { productId, pesoKg }
 */
export async function createMaterial({ descripcion }) {
  const { data } = await api.post('/api/materials', { descripcion })
  return data
}
export async function createColor({ descripcion }) {
  const { data } = await api.post('/api/colors', { descripcion })
  return data
}
export async function createPresentation({ productId, pesoKg }) {
  const { data } = await api.post('/api/product-presentations', {
    productId, pesoKg
  })
  return data
}

/**
 * Catálogos
 * GET /api/catalog/products?limit=...
 */
export async function listProducts({ limit=500 } = {}) {
  const { data } = await api.get('/api/catalog/products', { params: { limit } })
  return data
}

/**
 * GET /api/products/:id/composition
 * Respuesta: [{ ID_PRIMATER, ZONE, PERCENTAGE }]
 */
export async function getProductComposition(productId) {
  const { data } = await api.get(`/api/products/${productId}/composition`)
  return data
}

/**
 * GET /api/product-presentations?productId=...
 * Respuesta: [{ ID_PRESENTATION, PESO_KG (o PRESENTATION_KG) }]
 */
export async function listPresentationsByProduct(productId) {
  const { data } = await api.get('/api/product-presentations', { params: { productId } })
  return data
}

/**
 * === Ingreso de Producto Terminado (con consumo MP) ===
 * POST /api/stock/finished/input
 * body:
 * {
 *   productId, peso, presentationId,
 *   consumeMode: 'AUTO'|'MANUAL',
 *   manualConsumptions?: [{ primaterId, qty }]
 * }
 * Regla backend:
 *   - Entrada va SIEMPRE a zona ALMACEN (PT)
 *   - Consumo de MP debe intentarse desde zona PRODUCCION
 *   - Si falta stock MP en Producción → 400 { error: 'No hay MP disponible en Producción' }
 */
export async function createFinishedInput(payload) {
  const { data } = await api.post('/api/stock/finished/input', payload)
  return data
}
