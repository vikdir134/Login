// backend/src/utils/upload.js
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'

export const DOCS_DIR = process.env.DOCS_DIR || path.resolve(process.cwd(), 'uploads')
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || ''   // 👈

if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true })

function safeName(originalname) {
  const base = path.basename(originalname).replace(/\s+/g, '_')
  return base.replace(/[^a-zA-Z0-9._-]/g, '')
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, DOCS_DIR),
  filename: (_req, file, cb) => {
    const ts = Date.now()
    const clean = safeName(file.originalname || 'file.pdf')
    const ext = path.extname(clean).toLowerCase() || '.pdf'
    const name = clean.replace(ext, '')
    cb(null, `${name}__${ts}${ext}`)
  }
})

export const uploadPDF = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true)
    cb(new Error('Solo se permiten archivos PDF'))
  },
  limits: { fileSize: 25 * 1024 * 1024 }
})

// 👇 devuelve SIEMPRE absoluta si hay PUBLIC_BASE_URL
export function publicUrlFromAbs(absPath) {
  const rel = path.relative(DOCS_DIR, absPath).split(path.sep).join('/')
  return PUBLIC_BASE_URL
    ? `${PUBLIC_BASE_URL}/uploads/${rel}`
    : `/uploads/${rel}`
}
