// src/models/presentations.model.js
import { pool } from '../db.js'

// Listar presentaciones de un producto
export async function listPresentationsByProduct(productId) {
  const [rows] = await pool.query(
    `SELECT ID_PRESENTATION AS id, ID_PRODUCT AS productId, PESO AS peso
     FROM PRODUCT_PRESENTATIONS
     WHERE ID_PRODUCT = ?
     ORDER BY PESO ASC`,
    [productId]
  )
  return rows
}

// Crear presentación
export async function createPresentationModel({ productId, peso }) {
  const [res] = await pool.query(
    `INSERT INTO PRODUCT_PRESENTATIONS (ID_PRODUCT, PESO) VALUES (?, ?)`,
    [productId, peso]
  )
  return { id: res.insertId, productId, peso }
}
