import multer from 'multer'
import path from 'path'
import fs from 'fs'

const dest = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads')

if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, dest),
  filename: (_req, file, cb) => {
    const ts = Date.now()
    const safe = file.originalname.replace(/[^\w.\-]+/g, '_')
    cb(null, `${ts}__${safe}`)
  }
})

export const uploadPdf = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('Sólo PDF'))
    cb(null, true)
  },
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
})
