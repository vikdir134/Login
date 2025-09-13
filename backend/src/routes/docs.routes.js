// backend/src/routes/docs.routes.js
import { Router } from 'express'
import { uploadPDF, publicUrlFromAbs } from '../utils/upload.js'
import { pool } from '../db.js'

const router = Router()

// Sube factura
router.post('/invoices', uploadPDF.single('file'), async (req, res) => {
  try {
    const absPath = req.file.path
    const fileUrl = publicUrlFromAbs(absPath)

    // deducir code desde nombre original (antes del __timestamp)
    const original = req.file.originalname
    const code = (original || '').replace(/\.(pdf)$/i, '')

    // guarda en FACTURAS (con CODE y ARCHIVO_PATH)
    const [r] = await pool.query(
      `INSERT INTO FACTURAS (CODIGO, ARCHIVO_PATH) VALUES (?, ?)`,
      [code, fileUrl]
    )
    res.status(201).json({ id: r.insertId, code, archivoPath: fileUrl })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error subiendo factura' })
  }
})

// Sube guía
router.post('/guias', uploadPDF.single('file'), async (req, res) => {
  try {
    const absPath = req.file.path
    const fileUrl = publicUrlFromAbs(absPath)
    const original = req.file.originalname
    const code = (original || '').replace(/\.(pdf)$/i, '')

    // guarda en GUIAS (con CODE y ARCHIVO_PATH)
    const [r] = await pool.query(
      `INSERT INTO GUIAS (CODIGO, ARCHIVO_PATH) VALUES (?, ?)`,
      [code, fileUrl]
    )
    res.status(201).json({ id: r.insertId, code, archivoPath: fileUrl })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error subiendo guía' })
  }
})

export default router
