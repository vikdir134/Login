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
  return Number(rows[0].qty || 0)
}
async function sumMpStock(primaterId, spaceId) {
  const [rows] = await pool.query(
    `SELECT IFNULL(SUM(PESO),0) AS qty
       FROM STOCK_ZONE
      WHERE ID_PRIMATER = ? AND ID_SPACE = ?`,
    [primaterId, spaceId]
  )
  return Number(rows[0].qty || 0)
}
function isMermaSpaceName(name) {
  return String(name || '').toUpperCase().includes('MERMA')
}

// =============== Schemas ===============
const ingresoPtSchema = z.object({
  productId: z.number().int().positive(),
  spaceName: z.string().min(2),         // p.e. 'PT_ALMACEN'
  peso: z.number().positive(),
  observacion: z.string().max(100).optional().nullable()
})
const trasladoPtSchema = z.object({
  productId: z.number().int().positive(),
  fromSpaceName: z.string().min(2),
  toSpaceName: z.string().min(2),
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
export async function listPtStock(_req, res) {
  const [rows] = await pool.query(
    `SELECT p.ID_PRODUCT AS productId, p.DESCRIPCION AS productName,
            s.ID_SPACE AS spaceId, s.NOMBRE AS spaceName,
            IFNULL(SUM(f.PESO),0) AS qty
       FROM STOCK_FINISHED_PRODUCT f
       JOIN PRODUCTS p ON p.ID_PRODUCT = f.ID_PRODUCT
       JOIN SPACES   s ON s.ID_SPACE   = f.ID_SPACE
      GROUP BY p.ID_PRODUCT, s.ID_SPACE
      HAVING qty <> 0
      ORDER BY p.DESCRIPCION, s.NOMBRE`
  )
  res.json(rows)
}

export async function ptIngreso(req, res) {
  const parsed = ingresoPtSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })
  const { productId, spaceName, peso, observacion } = parsed.data
  const spaceId = await getSpaceIdByName(spaceName)
  if (!spaceId) return res.status(400).json({ error: 'Zona no existe' })

  await pool.query(
    `INSERT INTO STOCK_FINISHED_PRODUCT (ID_PRODUCT, ID_SPACE, PESO, FECHA)
     VALUES (?, ?, ?, NOW())`,
    [productId, spaceId, peso]
  )
  // OBSERVACION no existe en esta tabla; si quieres guardarla, añade columna o ignórala.
  res.status(201).json({ ok: true })
}

export async function ptTraslado(req, res) {
  const parsed = trasladoPtSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })
  const { productId, fromSpaceName, toSpaceName, peso } = parsed.data
  const fromId = await getSpaceIdByName(fromSpaceName)
  const toId   = await getSpaceIdByName(toSpaceName)
  if (!fromId || !toId) return res.status(400).json({ error: 'Zona origen/destino inválida' })

  // valida stock suficiente en origen
  const disponible = await sumPtStock(productId, fromId)
  if (disponible + 1e-9 < peso) {
    return res.status(400).json({ error: `Stock insuficiente en ${fromSpaceName}. Disponible: ${disponible}` })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.query(
      `INSERT INTO STOCK_FINISHED_PRODUCT (ID_PRODUCT, ID_SPACE, PESO, FECHA)
       VALUES (?, ?, ?, NOW())`,
      [productId, fromId, -peso]   // salida
    )
    await conn.query(
      `INSERT INTO STOCK_FINISHED_PRODUCT (ID_PRODUCT, ID_SPACE, PESO, FECHA)
       VALUES (?, ?, ?, NOW())`,
      [productId, toId, peso]      // entrada
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
