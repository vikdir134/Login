// src/lib/zones.js
import { pool } from '../db.js'

export async function getZone(conn, zoneId) {
  const [z] = await conn.query(`SELECT ID_SPACE id, NOMBRE, TIPO FROM SPACES WHERE ID_SPACE=?`, [zoneId])
  return z[0] || null
}

export function ensureZoneAccepts(typeNeeded, zone) {
  // typeNeeded: 'MP' | 'PT'
  // REGLAS
  if (typeNeeded === 'MP') {
    if (!['RECEPCION','PRODUCCION','MERMA'].includes(zone.TIPO)) {
      throw new Error(`Zona ${zone.NOMBRE} (${zone.TIPO}) no acepta Materia Prima`)
    }
  } else if (typeNeeded === 'PT') {
    if (zone.TIPO !== 'ALMACEN') {
      throw new Error(`Zona ${zone.NOMBRE} (${zone.TIPO}) no acepta Producto Terminado`)
    }
  }
}
