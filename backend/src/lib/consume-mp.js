// src/lib/consume-mp.js
import { pool } from '../db.js'

// consume MP por FIFO primero de PRODUCCION y luego de RECEPCION
export async function consumeMPFIFO(conn, { primaterId, peso }) {
  const need = Number(peso)
  if (!(need > 0)) return

  // zonas en orden de consumo
  const [zones] = await conn.query(
    `SELECT ID_SPACE id, TIPO FROM SPACES WHERE TIPO IN ('PRODUCCION','RECEPCION') ORDER BY FIELD(TIPO,'PRODUCCION','RECEPCION')`
  )
  let remaining = need

  for (const z of zones) {
    if (remaining <= 1e-9) break

    // Traer “lotes” por fecha de esa zona
    const [lots] = await conn.query(
      `SELECT sz.ID_STOCK_ZONE id, sz.PESO
       FROM STOCK_ZONE sz
       WHERE sz.ID_PRIMATER = ? AND sz.ID_SPACE = ?
       ORDER BY sz.FECHA ASC, sz.ID_STOCK_ZONE ASC`,
      [primaterId, z.id]
    )

    for (const lot of lots) {
      if (remaining <= 1e-9) break
      const take = Math.min(remaining, Number(lot.PESO))
      if (take <= 0) continue

      // registramos salida insertando movimiento de MP (origen z.id → destino PRODUCCION, pero aquí es “consumo”)
      await conn.query(
        `INSERT INTO STOCK_MOVEMENTS_PRIMARY
           (ID_ORIGIN_ZONE, ID_DESTINATION_ZONE, ID_PRIMATER, CANTIDAD, FECHA, OBSERVACION)
         VALUES (?, NULL, ?, ?, NOW(), 'Consumo para PT')`,
        [z.id, primaterId, take]
      )

      // reflejo de salida: insertamos negativo en STOCK_ZONE o insertamos otra fila con peso negativo
      await conn.query(
        `INSERT INTO STOCK_ZONE (ID_SPACE, ID_PRIMATER, PESO, FECHA, OBSERVACION)
         VALUES (?, ?, ?, NOW(), 'Consumo para PT')`,
        [z.id, primaterId, -take]
      )

      remaining -= take
    }
  }

  if (remaining > 1e-9) {
    throw new Error('Stock de Materia Prima insuficiente')
  }
}
