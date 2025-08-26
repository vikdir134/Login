// src/controllers/almacen.controller.js
import { z } from 'zod'
import { pool } from '../db.js'

// =============== helpers ===============
async function getSpaceIdByName(name) {
  const [rows] = await pool.query('SELECT ID_SPACE AS id FROM SPACES WHERE NOMBRE=? LIMIT 1', [name])
  return rows[0]?.id || null
}
async function sumPtStock(productId, spaceId) {
  const [rows] = await pool.query(
    `SELECT IFNULL(SUM(PESO),0) AS qty
       FROM STOCK_FINISHED_PRODUCT
      WHERE ID_PRODUCT = ? AND ID_SPACE = ?`,
    [productId, spaceId]
  )
  return Number(rows[0]?.qty || 0)
}
async function sumPtStockByPresentacion(productId, spaceId, presentacion) {
  // presentacion puede ser null -> cuenta solo “sin presentación”
  const [rows] = await pool.query(
    `SELECT IFNULL(SUM(PESO),0) AS qty
       FROM STOCK_FINISHED_PRODUCT
      WHERE ID_PRODUCT = ?
        AND ID_SPACE   = ?
        AND (PRESENTACION <=> ?)`, // null-safe
    [productId, spaceId, presentacion ?? null]
  )
  return Number(rows[0]?.qty || 0)
}
async function sumMpStock(primaterId, spaceId) {
  const [rows] = await pool.query(
    `SELECT IFNULL(SUM(PESO),0) AS qty
       FROM STOCK_ZONE
      WHERE ID_PRIMATER = ? AND ID_SPACE = ?`,
    [primaterId, spaceId]
  )
  return Number(rows[0]?.qty || 0)
}
function isMermaSpaceName(name) {
  return String(name || '').toUpperCase().includes('MERMA')
}

// =============== Schemas ===============
const ingresoPtSchema = z.object({
  productId: z.number().int().positive(),
  spaceName: z.string().min(2),         // p.e. 'PT_ALMACEN'
  presentacion: z.string().max(80).optional().nullable(), // <- TEXTO
  peso: z.number().positive(),
  observacion: z.string().max(100).optional().nullable()
})
const trasladoPtSchema = z.object({
  productId: z.number().int().positive(),
  fromSpaceName: z.string().min(2),
  toSpaceName: z.string().min(2),
  presentacion: z.string().max(80).optional().nullable(), // <- TEXTO
  peso: z.number().positive(),
  observacion: z.string().max(100).optional().nullable()
})
const ingresoMpSchema = z.object({
  primaterId: z.number().int().positive(),
  spaceName: z.string().min(2),
  peso: z.number().positive(),
  observacion: z.string().max(100).optional().nullable()
})
const trasladoMpSchema = z.object({
  primaterId: z.number().int().positive(),
  fromSpaceName: z.string().min(2),
  toSpaceName: z.string().min(2),
  peso: z.number().positive(),
  observacion: z.string().max(100).optional().nullable()
})

// =============== SPACES ===============
export async function listSpaces(_req, res) {
  const [rows] = await pool.query('SELECT ID_SPACE AS id, NOMBRE FROM SPACES ORDER BY NOMBRE')
  res.json(rows)
}

// =============== PT LIST/INGRESO/TRASLADO/DELETE ===============
/**
 * Stock PT agrupado por producto + zona + presentación (texto; null = sin presentación)
 */
export async function listPtStock(_req, res) {
  const [rows] = await pool.query(
    `SELECT p.ID_PRODUCT AS productId, p.DESCRIPCION AS productName,
            s.ID_SPACE AS spaceId, s.NOMBRE AS spaceName,
            f.PRESENTACION,
            IFNULL(SUM(f.PESO),0) AS qty
       FROM STOCK_FINISHED_PRODUCT f
       JOIN PRODUCTS p ON p.ID_PRODUCT = f.ID_PRODUCT
       JOIN SPACES   s ON s.ID_SPACE   = f.ID_SPACE
      GROUP BY p.ID_PRODUCT, s.ID_SPACE, f.PRESENTACION
      HAVING qty <> 0
      ORDER BY p.DESCRIPCION, s.NOMBRE, COALESCE(f.PRESENTACION,'')`
  )
  res.json(rows)
}

/**
 * (Opcional) Overview: totales por producto y desglose por presentación
 */
export async function listPtStockOverview(_req, res) {
  try {
    const [tot] = await pool.query(
      `SELECT p.ID_PRODUCT AS productId,
              p.DESCRIPCION AS productName,
              IFNULL(SUM(f.PESO),0) AS totalKg
         FROM STOCK_FINISHED_PRODUCT f
         JOIN PRODUCTS p ON p.ID_PRODUCT = f.ID_PRODUCT
        GROUP BY p.ID_PRODUCT, p.DESCRIPCION
        ORDER BY p.DESCRIPCION`
    )
    const [byPres] = await pool.query(
      `SELECT f.ID_PRODUCT AS productId,
              f.PRESENTACION,
              IFNULL(SUM(f.PESO),0) AS kg
         FROM STOCK_FINISHED_PRODUCT f
        GROUP BY f.ID_PRODUCT, f.PRESENTACION`
    )
    res.json({ totals: tot, byPresentation: byPres })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error listando stock PT (overview)' })
  }
}

export async function ptIngreso(req, res) {
  const parsed = ingresoPtSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })

  const { productId, spaceName, presentacion, peso } = parsed.data
  const spaceId = await getSpaceIdByName(spaceName)
  if (!spaceId) return res.status(400).json({ error: 'Zona no existe' })

  await pool.query(
    `INSERT INTO STOCK_FINISHED_PRODUCT (ID_PRODUCT, ID_SPACE, PRESENTACION, PESO, FECHA)
     VALUES (?, ?, ?, ?, NOW())`,
    [productId, spaceId, presentacion ?? null, peso]
  )
  res.status(201).json({ ok: true })
}

export async function ptTraslado(req, res) {
  const parsed = trasladoPtSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })

  const { productId, fromSpaceName, toSpaceName, presentacion, peso, observacion } = parsed.data
  const fromId = await getSpaceIdByName(fromSpaceName)
  const toId   = await getSpaceIdByName(toSpaceName)
  if (!fromId || !toId) return res.status(400).json({ error: 'Zona origen/destino inválida' })

  // disponible por producto + zona + PRESENTACION (texto; null = “sin presentación”)
  const disponible = presentacion != null
    ? await sumPtStockByPresentacion(productId, fromId, presentacion)
    : await sumPtStock(productId, fromId)

  if (disponible + 1e-9 < Number(peso)) {
    return res.status(400).json({
      error: `Stock insuficiente en ${fromSpaceName} para la presentación "${presentacion ?? '—'}". Disponible: ${disponible}`
    })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    // salida
    await conn.query(
      `INSERT INTO STOCK_FINISHED_PRODUCT (ID_PRODUCT, ID_SPACE, PRESENTACION, PESO, FECHA)
       VALUES (?, ?, ?, ?, NOW())`,
      [productId, fromId, presentacion ?? null, -Number(peso)]
    )
    // entrada
    await conn.query(
      `INSERT INTO STOCK_FINISHED_PRODUCT (ID_PRODUCT, ID_SPACE, PRESENTACION, PESO, FECHA)
       VALUES (?, ?, ?, ?, NOW())`,
      [productId, toId, presentacion ?? null, Number(peso)]
    )
    await conn.commit()
    res.json({ ok: true })
  } catch (e) {
    await conn.rollback()
    console.error(e)
    res.status(500).json({ error: 'Error trasladando PT' })
  } finally {
    conn.release()
  }
}

// sólo borrar movimientos PT si la zona es MERMA
export async function ptDeleteMermaOnly(req, res) {
  const id = Number(req.params.id)
  const [[row]] = await pool.query(
    `SELECT f.ID_PRO, s.NOMBRE AS spaceName
       FROM STOCK_FINISHED_PRODUCT f
       JOIN SPACES s ON s.ID_SPACE = f.ID_SPACE
      WHERE f.ID_PRO = ?`, [id]
  )
  if (!row) return res.status(404).json({ error: 'Movimiento no existe' })
  if (!isMermaSpaceName(row.spaceName)) {
    return res.status(403).json({ error: 'Solo se puede borrar en zona MERMA' })
  }
  await pool.query('DELETE FROM STOCK_FINISHED_PRODUCT WHERE ID_PRO=?', [id])
  res.json({ ok: true })
}

// =============== MP LIST/INGRESO/TRASLADO/DELETE ===============
export async function listMpStock(_req, res) {
  const [rows] = await pool.query(
    `SELECT pm.ID_PRIMATER AS primaterId,
            CONCAT(m.DESCRIPCION, IFNULL(CONCAT(' ', c.DESCRIPCION), ''), IF(pm.DENIER, CONCAT(' ', pm.DENIER), '')) AS primaterName,
            s.ID_SPACE AS spaceId, s.NOMBRE AS spaceName,
            IFNULL(SUM(z.PESO),0) AS qty
       FROM STOCK_ZONE z
       JOIN PRIMARY_MATERIALS pm ON pm.ID_PRIMATER = z.ID_PRIMATER
       JOIN MATERIALS m ON m.ID_MATERIAL = pm.ID_MATERIAL
       LEFT JOIN COLORS c ON c.ID_COLOR = pm.ID_COLOR
       JOIN SPACES s ON s.ID_SPACE = z.ID_SPACE
      GROUP BY pm.ID_PRIMATER, s.ID_SPACE
      HAVING qty <> 0
      ORDER BY primaterName, s.NOMBRE`
  )
  res.json(rows)
}

export async function mpIngreso(req, res) {
  const parsed = ingresoMpSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })
  const { primaterId, spaceName, peso, observacion } = parsed.data
  const spaceId = await getSpaceIdByName(spaceName)
  if (!spaceId) return res.status(400).json({ error: 'Zona no existe' })

  await pool.query(
    `INSERT INTO STOCK_ZONE (ID_SPACE, ID_PRIMATER, PESO, FECHA, OBSERVACION)
     VALUES (?, ?, ?, NOW(), ?)`,
    [spaceId, primaterId, peso, observacion ?? null]
  )
  res.status(201).json({ ok: true })
}

export async function mpTraslado(req, res) {
  const parsed = trasladoMpSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })
  const { primaterId, fromSpaceName, toSpaceName, peso, observacion } = parsed.data
  const fromId = await getSpaceIdByName(fromSpaceName)
  const toId   = await getSpaceIdByName(toSpaceName)
  if (!fromId || !toId) return res.status(400).json({ error: 'Zona origen/destino inválida' })

  const disponible = await sumMpStock(primaterId, fromId)
  if (disponible + 1e-9 < peso) {
    return res.status(400).json({ error: `Stock insuficiente en ${fromSpaceName}. Disponible: ${disponible}` })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.query(
      `INSERT INTO STOCK_ZONE (ID_SPACE, ID_PRIMATER, PESO, FECHA, OBSERVACION)
       VALUES (?, ?, ?, NOW(), ?)`,
      [fromId, primaterId, -peso, observacion ?? 'Traslado salida']
    )
    await conn.query(
      `INSERT INTO STOCK_ZONE (ID_SPACE, ID_PRIMATER, PESO, FECHA, OBSERVACION)
       VALUES (?, ?, ?, NOW(), ?)`,
      [toId, primaterId, peso, observacion ?? 'Traslado entrada']
    )
    await conn.commit()
    res.json({ ok: true })
  } catch (e) {
    await conn.rollback()
    console.error(e)
    res.status(500).json({ error: 'Error trasladando MP' })
  } finally {
    conn.release()
  }
}

export async function mpDeleteMermaOnly(req, res) {
  const id = Number(req.params.id)
  const [[row]] = await pool.query(
    `SELECT z.ID_STOCK_ZONE, s.NOMBRE AS spaceName
       FROM STOCK_ZONE z
       JOIN SPACES s ON s.ID_SPACE = z.ID_SPACE
      WHERE z.ID_STOCK_ZONE = ?`, [id]
  )
  if (!row) return res.status(404).json({ error: 'Movimiento no existe' })
  if (!isMermaSpaceName(row.spaceName)) {
    return res.status(403).json({ error: 'Solo se puede borrar en zona MERMA' })
  }
  await pool.query('DELETE FROM STOCK_ZONE WHERE ID_STOCK_ZONE=?', [id])
  res.json({ ok: true })
}
