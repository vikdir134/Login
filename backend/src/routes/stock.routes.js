// src/routes/stock.routes.js
import { Router } from 'express'
import { pool } from '../db.js'
export const stockRouter = Router()

// MP
stockRouter.post('/primary', async (req, res) => {
  const { primaterId, zoneId, peso, observacion } = req.body
  if (!primaterId || !zoneId || !(+peso > 0)) return res.status(400).json({ error: 'Datos inválidos' })
  const [r] = await pool.query(
    `INSERT INTO STOCK_ZONE (ID_SPACE, ID_PRIMATER, PESO, FECHA, OBSERVACION)
     VALUES (?, ?, ?, NOW(), ?)`,
    [zoneId, primaterId, peso, observacion ?? null]
  )
  res.status(201).json({ id: r.insertId })
})

// PT
stockRouter.post('/finished', async (req, res) => {
  const { productId, zoneId, peso, observacion } = req.body
  if (!productId || !zoneId || !(+peso > 0)) return res.status(400).json({ error: 'Datos inválidos' })
  const [r] = await pool.query(
    `INSERT INTO STOCK_FINISHED_PRODUCT (ID_PRODUCT, ID_SPACE, PESO, FECHA)
     VALUES (?, ?, ?, NOW())`,
    [productId, zoneId, peso]
  )
  // Puedes registrar un movimiento en una tabla de movimientos PT si lo deseas
  res.status(201).json({ id: r.insertId })
})

// mover entre zonas (MP o PT)
stockRouter.post('/move', async (req, res) => {
  const { type, itemId, fromZoneId, toZoneId, peso, observacion } = req.body
  if (!['PRIMARY','FINISHED'].includes(type)) return res.status(400).json({ error: 'type inválido' })
  if (!itemId || !fromZoneId || !toZoneId || !(+peso>0)) return res.status(400).json({ error: 'Datos inválidos' })
  if (fromZoneId === toZoneId) return res.status(400).json({ error: 'Zonas iguales' })

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    if (type === 'PRIMARY') {
      // sumar en destino
      await conn.query(
        `INSERT INTO STOCK_ZONE (ID_SPACE, ID_PRIMATER, PESO, FECHA, OBSERVACION)
         VALUES (?, ?, ?, NOW(), ?)`,
        [toZoneId, itemId, peso, observacion ?? null]
      )
      // movimiento MP (opcional)
      await conn.query(
        `INSERT INTO STOCK_MOVEMENTS_PRIMARY (ID_ORIGIN_ZONE, ID_DESTINATION_ZONE, ID_PRIMATER, CANTIDAD, FECHA, OBSERVACION)
         VALUES (?, ?, ?, ?, NOW(), ?)`,
        [fromZoneId, toZoneId, itemId, peso, observacion ?? null]
      )
    } else {
      // FINISHED: insertamos fila en destino; si manejas “restas” explícitas, crea tabla movimientos PT
      await conn.query(
        `INSERT INTO STOCK_FINISHED_PRODUCT (ID_PRODUCT, ID_SPACE, PESO, FECHA)
         VALUES (?, ?, ?, NOW())`,
        [itemId, toZoneId, peso]
      )
      // para reflejar salida del origen podrías insertar con PESO negativo en origen (si manejas una vista de saldos)
      // o llevar la lógica usando una tabla de movimientos PT. Simplificamos dejando el alta en destino.
    }

    await conn.commit()
    res.json({ ok: true })
  } catch (e) {
    await conn.rollback()
    res.status(400).json({ error: e.message })
  } finally {
    conn.release()
  }
})
