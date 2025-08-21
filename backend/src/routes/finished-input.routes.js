// backend/src/routes/finished-input.routes.js
import { Router } from 'express'
import { pool } from '../db.js'
import { getZone, ensureZoneAccepts } from '../lib/zones.js'
import { consumeMPFIFO } from '../lib/consume-mp.js'

export const finishedInputRouter = Router()

// POST /api/stock/finished/input
finishedInputRouter.post('/input', async (req, res) => {
  const {
    productId,
    zoneId,
    peso,
    presentationId,
    presentationKg,
    useComposition,
    consumos
  } = req.body

  if (!productId || !zoneId || !(+peso > 0)) {
    return res.status(400).json({ error: 'Datos inválidos' })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const zone = await getZone(conn, zoneId)
    if (!zone) throw new Error('Zona no existe')
    ensureZoneAccepts('PT', zone)

    // composición
    const [comp] = await conn.query(
      `SELECT ID_PRIMATER primaterId, ZONE, PERCENTAGE
       FROM PRODUCT_COMPOSITION WHERE ID_PRODUCT = ?`,
      [productId]
    )
    const hasComposition = comp.length > 0
    const willUseComposition = (useComposition === undefined) ? hasComposition : !!useComposition

    let toConsume = []
    if (willUseComposition) {
      if (!hasComposition) throw new Error('El producto no tiene composición definida')
      for (const c of comp) {
        const need = (Number(c.PERCENTAGE) / 100) * Number(peso)
        if (need > 0) toConsume.push({ primaterId: c.primaterId, peso: need })
      }
    } else {
      if (!Array.isArray(consumos) || consumos.length === 0) {
        throw new Error('Debe indicar consumos de MP')
      }
      const sum = consumos.reduce((a, b) => a + Number(b.peso || 0), 0)
      if (sum > Number(peso) + 1e-9) {
        throw new Error('La suma de consumos no puede exceder el peso del PT')
      }
      toConsume = consumos.map(x => ({ primaterId: Number(x.primaterId), peso: Number(x.peso) }))
    }

    // consumir MP (produce filas negativas en STOCK_ZONE)
    for (const item of toConsume) {
      await consumeMPFIFO(conn, { primaterId: item.primaterId, peso: item.peso, note: `Consumo PT#?` })
    }

    // presentación
    let presId = presentationId ?? null
    let presKg = null

    if (presentationId) {
      const [[p]] = await conn.query(
        `SELECT ID_PRESENTATION, ID_PRODUCT, PESO_KG FROM PRODUCT_PRESENTATIONS WHERE ID_PRESENTATION=?`,
        [presentationId]
      )
      if (!p) throw new Error('Presentación no encontrada')
      if (Number(p.ID_PRODUCT) !== Number(productId)) throw new Error('Presentación no corresponde al producto')
      presKg = Number(p.PESO_KG)
    } else if (presentationKg) {
      presKg = Number(presentationKg)
      if (!(presKg > 0)) throw new Error('presentationKg inválido')
    }

    await conn.query(
      `INSERT INTO STOCK_FINISHED_PRODUCT
         (ID_PRODUCT, ID_SPACE, PESO, FECHA, PRESENTATION_KG, ID_PRESENTATION)
       VALUES (?, ?, ?, NOW(), ?, ?)`,
      [productId, zoneId, Number(peso), presKg, presId]
    )

    await conn.commit()
    res.status(201).json({ ok: true })
  } catch (e) {
    await conn.rollback()
    const msg = e.message || 'Error'
    if (/no admite|no existe|consumos|Presentación|insuficiente/.test(msg)) {
      return res.status(400).json({ error: msg })
    }
    console.error(e)
    res.status(500).json({ error: 'Error al ingresar PT' })
  } finally {
    conn.release()
  }
})
