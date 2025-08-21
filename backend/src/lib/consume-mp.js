// backend/src/lib/consume-mp.js
import { getFirstZoneByTipo } from './zones.js'

/**
 * Descuenta MP con prioridad: PRODUCCION y luego RECEPCION.
 * Inserta filas negativas en STOCK_ZONE (modelo basado en movimientos).
 *
 * @param {object} conn  - conexión (transacción abierta)
 * @param {object} p     - { primaterId: number, peso: number, note?: string }
 */
export async function consumeMPFIFO(conn, { primaterId, peso, note }) {
  const need = Number(peso)
  if (!(need > 0)) throw new Error('Consumo inválido')

  const prodZone = await getFirstZoneByTipo(conn, 'PRODUCCION')
  const recZone  = await getFirstZoneByTipo(conn, 'RECEPCION')
  if (!prodZone || !recZone) throw new Error('Zonas PRODUCCION o RECEPCION no configuradas')

  const getSaldo = async (zoneId) => {
    const [[r]] = await conn.query(
      `SELECT IFNULL(SUM(PESO),0) saldo
       FROM STOCK_ZONE
       WHERE ID_SPACE=? AND ID_PRIMATER=?`,
      [zoneId, primaterId]
    )
    return Number(r?.saldo || 0)
  }

  let remaining = need

  // 1) consumir de PRODUCCION
  const saldoProd = await getSaldo(prodZone.id)
  if (saldoProd > 0) {
    const consume = Math.min(saldoProd, remaining)
    if (consume > 1e-9) {
      await conn.query(
        `INSERT INTO STOCK_ZONE (ID_SPACE, ID_PRIMATER, PESO, FECHA, OBSERVACION)
         VALUES (?, ?, ?, NOW(), ?)`,
        [prodZone.id, primaterId, -consume, note || 'Consumo PT (producción)']
      )
      remaining -= consume
    }
  }

  // 2) faltar → consumir de RECEPCION
  if (remaining > 1e-9) {
    const saldoRec = await getSaldo(recZone.id)
    if (saldoRec <= 0 || saldoRec + 1e-9 < remaining) {
      throw new Error('Stock insuficiente de MP (Producción+Recepción)')
    }
    await conn.query(
      `INSERT INTO STOCK_ZONE (ID_SPACE, ID_PRIMATER, PESO, FECHA, OBSERVACION)
       VALUES (?, ?, ?, NOW(), ?)`,
      [recZone.id, primaterId, -remaining, note || 'Consumo PT (recepción)']
    )
    remaining = 0
  }
}
