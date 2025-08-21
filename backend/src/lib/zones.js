// backend/src/lib/zones.js
import { pool } from '../db.js'

export async function getZone(connOrNull, zoneId) {
  const conn = connOrNull || pool
  const [[z]] = await conn.query(
    'SELECT ID_SPACE id, NOMBRE name, TIPO tipo FROM SPACES WHERE ID_SPACE=?',
    [zoneId]
  )
  return z || null
}

// mapea un TIPO a una zona (elige la primera que encuentre)
export async function getFirstZoneByTipo(connOrNull, tipo) {
  const conn = connOrNull || pool
  const [[z]] = await conn.query(
    'SELECT ID_SPACE id, NOMBRE name, TIPO tipo FROM SPACES WHERE TIPO=? ORDER BY ID_SPACE LIMIT 1',
    [tipo]
  )
  return z || null
}

// valida si una operación es válida por tipo de item y tipo de zona
export function ensureZoneAccepts(kind, zone) {
  // kind: 'MP' | 'PT'
  // MP solo en RECEPCION/PRODUCCION; PT solo en ALMACEN (para ingresos)
  if (kind === 'MP') {
    if (!['RECEPCION','PRODUCCION'].includes(zone.tipo)) {
      throw new Error(`La zona (${zone.name}) no admite MP (tipo=${zone.tipo})`)
    }
  } else if (kind === 'PT') {
    if (zone.tipo !== 'ALMACEN') {
      throw new Error(`La zona (${zone.name}) no admite PT (tipo=${zone.tipo})`)
    }
  }
}
