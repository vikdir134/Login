import path from 'path'
import { InvoicesModel } from '../models/invoices.model.js'
import { GuiasModel } from '../models/guias.model.js'
import { CreditNotesModel } from '../models/credit-notes.model.js'

const publicPath = (filename) => `/uploads/${filename}`

export async function uploadInvoiceCtrl(req, res) {
  try {
    const file = req.file
    if (!file) return res.status(400).json({ error:'Archivo PDF requerido' })
    // código desde nombre archivo (sin extensión)
    const base = path.basename(file.originalname, path.extname(file.originalname))
    const code = req.body?.code?.trim() || base
    const out = await InvoicesModel.createWithFile({
      code,
      archivoPath: publicPath(file.filename),
      archivoName: file.originalname
    })
    res.status(201).json(out)
  } catch (e) {
    console.error(e); res.status(500).json({ error:'Error subiendo factura' })
  }
}

export async function uploadGuiaCtrl(req, res) {
  try {
    const file = req.file
    if (!file) return res.status(400).json({ error:'Archivo PDF requerido' })
    const base = path.basename(file.originalname, path.extname(file.originalname))
    const code = req.body?.code?.trim() || base
    const out = await GuiasModel.createWithFile({
      code,
      archivoPath: publicPath(file.filename),
      archivoName: file.originalname
    })
    res.status(201).json(out)
  } catch (e) {
    console.error(e); res.status(500).json({ error:'Error subiendo guía' })
  }
}

export async function createCreditNoteCtrl(req, res) {
  try {
    const { tipo, idDoc, code, motivo } = req.body
    if (!['FACTURA','GUIA'].includes(tipo)) return res.status(400).json({ error:'Tipo inválido' })
    const file = req.file || null
    const out = await CreditNotesModel.create({
      tipo,
      idDoc: Number(idDoc),
      code: code?.trim() || `NC-${Date.now()}`,
      archivoPath: file ? publicPath(file.filename) : null,
      archivoName: file?.originalname || null,
      motivo
    })
    res.status(201).json(out)
  } catch (e) {
    console.error(e); res.status(500).json({ error:'Error creando nota de crédito' })
  }
}
