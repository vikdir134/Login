import api from './axios'

export async function uploadInvoice(file) {
  const fd = new FormData()
  fd.append('file', file) // el código se toma del nombre (backend)
  return api.post('/api/docs/invoices', fd, { headers:{ 'Content-Type':'multipart/form-data' }}).then(r=>r.data)
}

export async function uploadGuia(file) {
  const fd = new FormData()
  fd.append('file', file)
  return api.post('/api/docs/guias', fd, { headers:{ 'Content-Type':'multipart/form-data' }}).then(r=>r.data)
}

export async function createCreditNote({ tipo, idDoc, code, file, motivo }) {
  const fd = new FormData()
  fd.append('tipo', tipo) // 'FACTURA' | 'GUIA'
  fd.append('idDoc', String(idDoc))
  if (code) fd.append('code', code)
  if (motivo) fd.append('motivo', motivo)
  if (file) fd.append('file', file)
  return api.post('/api/docs/credit-notes', fd, { headers:{ 'Content-Type':'multipart/form-data' }}).then(r=>r.data)
}
