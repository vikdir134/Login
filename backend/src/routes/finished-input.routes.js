// backend/src/routes/finished-input.routes.js
import { Router } from 'express'
import { pool } from '../db.js'

export const finishedInputRouter = Router()

const EPS = 1e-9

async function getZoneByTipo(conn, tipo) {
  const [[z]] = await conn.query(
    'SELECT ID_SPACE AS id, NOMBRE AS name, TIPO AS tipo FROM SPACES WHERE TIPO=? ORDER BY ID_SPACE LIMIT 1',
    [String(tipo || '').toUpperCase()]
  )
  return z || null
}

/**
 * Toma MP en cascada: intenta primero por una lista de TIPO de zona (orden de prioridad).
 * Por ejemplo: ['PRODUCCION','RECEPCION']
 * Inserta salidas negativas en STOCK_ZONE por cada zona de donde consuma.
 * Lanza error si no alcanza el stock total requerido.
 */
async function takePrimaryCascade(conn, primaterId, qtyNeeded, orderTipos) {
  let remaining = Number(qtyNeeded || 0)
  const tipos = (orderTipos || []).map(t => String(t || '').toUpperCase()).filter(Boolean)

  for (const tipo of tipos) {
    if (remaining <= EPS) break
    const z = await getZoneByTipo(conn, tipo)
    if (!z) continue

    const [[{ saldo }]] = await conn.query(
      'SELECT IFNULL(SUM(PESO),0) saldo FROM STOCK_ZONE WHERE ID_SPACE=? AND ID_PRIMATER=?',
      [z.id, primaterId]
    )

    const take = Math.min(remaining, Number(saldo || 0))
    if (take > EPS) {
      await conn.query(
        `INSERT INTO STOCK_ZONE (ID_SPACE, ID_PRIMATER, PESO, FECHA, OBSERVACION)
         VALUES (?, ?, ?, NOW(), ?)`,
        [z.id, primaterId, -take, `Consumo PT (cascada) desde ${z.tipo}`]
      )
      remaining -= take
    }
  }

  if (remaining > EPS) {
    throw new Error(`MP #${primaterId} insuficiente en Producción/Recepción`)
  }
}

// POST /api/stock/finished/input
finishedInputRouter.post('/input', async (req, res) => {
  const productId      = Number(req.body?.productId)
  const pesoTotal      = Number(req.body?.peso || 0)
  const useComposition = !!req.body?.useComposition
  const presentationKg = req.body?.presentationKg != null ? Number(req.body.presentationKg) : null
  const consumosMan    = Array.isArray(req.body?.consumos) ? req.body.consumos : []

  if (!productId || !(pesoTotal > 0)) {
    return res.status(400).json({ error: 'Datos inválidos (productId/peso)' })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // Zona destino (PT)
    const almacen = await getZoneByTipo(conn, 'ALMACEN')
    if (!almacen) throw new Error('No existe zona ALMACEN')

    // ---- Construir consumos (AUTO vs MANUAL) ----
    let consumos = []
    if (useComposition) {
      // Lee TODAS las filas; no exigimos ZONE=TRONCO ni similares
      const [comp] = await conn.query(
        `SELECT ID_PRIMATER AS primaterId, ZONE AS zone, PERCENTAGE AS percentage
           FROM PRODUCT_COMPOSITION
          WHERE ID_PRODUCT=?`,
        [productId]
      )
      if (!Array.isArray(comp) || comp.length === 0) {
        // si el front mandó useComposition pero no hay filas, error claro
        await conn.rollback()
        return res.status(400).json({ error: 'El producto no tiene composición' })
      }
      consumos = comp.map(c => ({
        primaterId: Number(c.primaterId),
        // si viene zone, la respetamos como preferida en el orden
        preferredZone: String(c.zone || '').toUpperCase(), // 'PRODUCCION' | 'RECEPCION' | ''
        qty: +(pesoTotal * (Number(c.percentage || 0) / 100)).toFixed(2),
      }))
    } else {
      // Manual
      const sum = consumosMan.reduce((a, c) => a + Number(c.peso || 0), 0)
      if (sum - pesoTotal > EPS) {
        await conn.rollback()
        return res.status(400).json({ error: 'La suma de consumos manuales supera el peso total' })
      }
      consumos = consumosMan.map(c => ({
        primaterId: Number(c.primaterId),
        preferredZone: 'PRODUCCION', // manual siempre intenta producir primero
        qty: Number(c.peso)
      }))
    }

    // ---- Descontar consumos en cascada ----
    // Política de cascada:
    //   - Si la fila tiene preferredZone válida -> [preferred, la otra]
    //   - Si no tiene preferred -> ['PRODUCCION','RECEPCION']
    if (consumos.length) {
      for (const c of consumos) {
        if (!(c.primaterId > 0) || !(c.qty > EPS)) continue
        const pref = (c.preferredZone === 'PRODUCCION' || c.preferredZone === 'RECEPCION')
          ? c.preferredZone
          : null

        const order = pref === 'RECEPCION'
          ? ['RECEPCION', 'PRODUCCION']
          : ['PRODUCCION', 'RECEPCION']

        await takePrimaryCascade(conn, c.primaterId, c.qty, order)
      }
    }

    // ---- Insertar PT en ALMACEN ----
    const presentValue = (presentationKg && presentationKg > 0)
      ? Number(presentationKg.toFixed(2))
      : null

    await conn.query(
      `INSERT INTO STOCK_FINISHED_PRODUCT
        (ID_PRODUCT, ID_SPACE, PESO, FECHA, PRESENTACION)
      VALUES (?, ?, ?, NOW(), ?)`,
      [productId, almacen.id, pesoTotal, presentValue]
    )

    await conn.commit()
    res.status(201).json({ ok: true })
  } catch (e) {
    await conn.rollback()
    console.error('[finished-input] Error:', e)
    res.status(400).json({ error: e.message || 'Error registrando PT' })
  } finally {
    conn.release()
  }
})
