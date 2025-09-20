// src/components/CreateDeliveryModal.jsx
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { getEffectivePrice } from '@/api/prices'
import { createDelivery } from '@/api/deliveries'
import { uploadInvoice, uploadGuia } from '@/api/docs'

/* shadcn ui */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'

const fmtKg = n => (Number(n) || 0).toFixed(2)
const fmtMoney = n => (Number(n) || 0).toFixed(2)

export default function CreateDeliveryModal({ open, onClose, order, onDone }) {
  const [rows, setRows] = useState([
    { descriptionOrderId: '', peso: '', unitPrice: '', currency: 'PEN', descripcion: '' }
  ])
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')

  // PDFs opcionales
  const [pdfFactura, setPdfFactura] = useState(null)
  const [pdfGuia, setPdfGuia] = useState(null)

  // Confirmación (sin docs)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingPayload, setPendingPayload] = useState(null)

  // Mapa de líneas
  const lineMap = useMemo(() => {
    const m = new Map()
    for (const l of order?.lines || []) m.set(String(l.id), l)
    return m
  }, [order])

  useEffect(() => {
    if (!open) return
    setRows([{ descriptionOrderId: '', peso: '', unitPrice: '', currency: 'PEN', descripcion: '' }])
    setMsg('')
    setSending(false)
    setPdfFactura(null)
    setPdfGuia(null)
    setConfirmOpen(false)
    setPendingPayload(null)
  }, [open])

  const setRow = (i, patch) =>
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const addRow = () =>
    setRows(rs => [...rs, { descriptionOrderId: '', peso: '', unitPrice: '', currency: 'PEN', descripcion: '' }])

  const removeRow = (i) =>
    setRows(rs => rs.filter((_, idx) => idx !== i))

  // Validación: precio obligatorio (> 0)
  const canSubmit = useMemo(() => {
    if (!rows.length) return false
    for (const r of rows) {
      if (!r.descriptionOrderId) return false
      if (!(Number(r.peso) > 0)) return false
      const line = lineMap.get(String(r.descriptionOrderId))
      if (!line) return false
      if (Number(r.peso) > Number(line.pendiente || 0) + 1e-9) return false
      if (!(Number(r.unitPrice) > 0)) return false // precio requerido y > 0
    }
    return true
  }, [rows, lineMap])

  const subtotalTotal = rows.reduce(
    (a, r) => a + (Number(r.peso) || 0) * (Number(r.unitPrice || 0) || 0),
    0
  )

  const onPickLine = async (i, descriptionOrderId) => {
    setRow(i, { descriptionOrderId })
    const line = lineMap.get(String(descriptionOrderId))
    if (!line) return
    if (rows[i].unitPrice === '' || rows[i].unitPrice == null) {
      const eff = await getEffectivePrice({ customerId: order.customerId, productId: line.productId }).catch(() => null)
      if (eff && Number(eff.price) > 0) {
        setRow(i, {
          unitPrice: String(eff.price),
          currency: eff.currency || 'PEN'
        })
      }
    }
  }

  const buildPayload = async () => {
    // 1) Subir PDFs si hay
    let facturaId = null
    let guiaId = null

    if (pdfFactura) {
      const inv = await uploadInvoice(pdfFactura).catch((err) => {
        throw new Error(err?.response?.data?.error || 'No se pudo subir la factura PDF')
      })
      facturaId = inv?.id || null
    }
    if (pdfGuia) {
      const gv = await uploadGuia(pdfGuia).catch((err) => {
        throw new Error(err?.response?.data?.error || 'No se pudo subir la guía PDF')
      })
      guiaId = gv?.id || null
    }

    // 2) Normalizar líneas
    const lines = rows.map(r => ({
      descriptionOrderId: Number(r.descriptionOrderId),
      peso: Number(r.peso),
      descripcion: r.descripcion || null,
      unitPrice: Number(r.unitPrice),
      currency: r.currency || 'PEN'
    }))

    const hasDocs = !!facturaId || !!guiaId
    return { payload: { facturaId, guiaId, lines }, hasDocs }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit || sending) {
      // feedback si falta precio en alguna fila
      const faltaPrecio = rows.some(r => !(Number(r.unitPrice) > 0))
      if (faltaPrecio) setMsg('Hay líneas sin precio. Ingresa un precio mayor a 0 en todas las líneas.')
      return
    }
    setSending(true); setMsg('')
    try {
      const { payload, hasDocs } = await buildPayload()
      if (!hasDocs) {
        setPendingPayload(payload)
        setConfirmOpen(true)
        setSending(false)
        return
      }
      await createDelivery(order.id, payload)
      toast.success('Entrega registrada')
      onDone?.()
    } catch (err) {
      console.error('CreateDelivery error:', err?.response?.data || err)
      setMsg(err?.response?.data?.error || err?.message || 'Error creando entrega')
      setSending(false)
    }
  }

  const confirmSubmitWithoutDocs = async () => {
    if (!pendingPayload) { setConfirmOpen(false); return }
    setSending(true); setMsg('')
    try {
      await createDelivery(order.id, { ...pendingPayload, allowNoDocs: true })
      setConfirmOpen(false)
      setPendingPayload(null)
      toast.success('Entrega registrada')
      onDone?.()
    } catch (err) {
      const status = err?.response?.status
      const code = err?.response?.data?.code
      if (status === 409 && code === 'CONFIRM_NODOCS_REQUIRED') {
        try {
          await createDelivery(order.id, { ...pendingPayload, allowNoDocs: true })
          setConfirmOpen(false)
          setPendingPayload(null)
          toast.success('Entrega registrada')
          onDone?.()
        } catch (inner) {
          console.error(inner)
          setMsg(inner?.response?.data?.error || 'No se pudo crear la entrega')
        }
      } else {
        console.error(err)
        setMsg(err?.response?.data?.error || 'No se pudo crear la entrega')
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o)=>{ if(!o) onClose?.() }}>
        {/* Ancho + body con scroll */}
        <DialogContent className="w-[96vw] sm:max-w-5xl md:max-w-6xl p-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b">
            <DialogTitle>Nueva entrega (múltiples líneas)</DialogTitle>
            <DialogDescription>
              Registra una entrega con una o varias líneas. La factura y/o guía son opcionales.
            </DialogDescription>
          </DialogHeader>

          {/* Body con scroll interno */}
          <div className="px-6 pb-6 overflow-y-auto" style={{ maxHeight: '65vh' }}>
            <form id="create-delivery-form" onSubmit={submit} className="space-y-5">
              {/* ====== ARCHIVOS PDF OPCIONALES ====== */}
              <Card className="border-dashed">
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Factura (PDF)</div>
                      <Input
                        type="file"
                        accept="application/pdf"
                        onChange={e => setPdfFactura(e.target.files?.[0] || null)}
                      />
                      {pdfFactura && (
                        <div className="text-xs text-muted-foreground">
                          Se tomará el código desde el nombre: <b>{pdfFactura.name}</b>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="text-sm font-medium">Guía (PDF)</div>
                      <Input
                        type="file"
                        accept="application/pdf"
                        onChange={e => setPdfGuia(e.target.files?.[0] || null)}
                      />
                      {pdfGuia && (
                        <div className="text-xs text-muted-foreground">
                          Se tomará el código desde el nombre: <b>{pdfGuia.name}</b>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ====== LÍNEAS ====== */}
              <div className="text-sm text-muted-foreground">Líneas de la entrega</div>

              <div className="space-y-3">
                {rows.map((r, i) => {
                  const line = lineMap.get(String(r.descriptionOrderId))
                  const warnPeso = line && Number(r.peso) > Number(line.pendiente)
                  const warnPrecio = !(Number(r.unitPrice) > 0)
                  return (
                    <Card key={i} className={warnPeso ? 'border-red-600' : ''}>
                      <CardContent className="p-3 space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                          {/* Línea (Select shadcn) */}
                          <div className="md:col-span-6 space-y-1">
                            <div className="text-sm font-medium">Línea (producto · presentación)</div>
                            <Select
                              value={r.descriptionOrderId ? String(r.descriptionOrderId) : undefined}
                              onValueChange={(val) => onPickLine(i, val)}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Selecciona una línea" />
                              </SelectTrigger>
                              <SelectContent>
                                {(order?.lines || []).map(l => (
                                  <SelectItem key={l.id} value={String(l.id)}>
                                    {l.productName} · {l.presentacion ?? '—'} · Pend {fmtKg(l.pendiente)} kg
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Peso */}
                          <div className="md:col-span-2 space-y-1">
                            <div className="text-sm font-medium">Peso (kg)</div>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={r.peso}
                              onChange={e => setRow(i, { peso: e.target.value })}
                              required
                            />
                            {warnPeso && (
                              <div className="text-xs text-red-600">
                                Máx {fmtKg(line.pendiente)} kg
                              </div>
                            )}
                          </div>

                          {/* Precio unit */}
                          <div className="md:col-span-2 space-y-1">
                            <div className="text-sm font-medium">Precio unit.</div>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={r.unitPrice}
                              onChange={e => setRow(i, { unitPrice: e.target.value })}
                              placeholder="Requerido"
                            />
                            {warnPrecio && (
                              <div className="text-xs text-red-600">Ingresa un precio mayor a 0</div>
                            )}
                          </div>

                          {/* Moneda (Select shadcn) */}
                          <div className="md:col-span-2 space-y-1">
                            <div className="text-sm font-medium">Moneda</div>
                            <Select
                              value={r.currency}
                              onValueChange={(val) => setRow(i, { currency: val })}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Moneda" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PEN">PEN</SelectItem>
                                <SelectItem value="USD">USD</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Quitar */}
                          <div className="md:col-span-12 flex items-center justify-end">
                            {rows.length > 1 && (
                              <Button type="button" variant="secondary" onClick={() => removeRow(i)}>
                                Quitar
                              </Button>
                            )}
                          </div>

                          {/* Comentario */}
                          <div className="md:col-span-12 space-y-1">
                            <div className="text-sm font-medium">Comentario</div>
                            <Input
                              value={r.descripcion}
                              onChange={e => setRow(i, { descripcion: e.target.value })}
                              maxLength={50}
                              placeholder="Opcional"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" onClick={addRow}>+ Línea</Button>
                <div className="text-sm text-muted-foreground">
                  Subtotal estimado: <b>{fmtMoney(subtotalTotal)}</b>
                </div>
              </div>

              {msg && <div className="text-sm text-red-600">{msg}</div>}

              <div className="h-2" />
            </form>
          </div>

          <DialogFooter className="px-6 py-4 border-t">
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" form="create-delivery-form" disabled={!canSubmit || sending}>
              {sending ? 'Guardando…' : 'Registrar entrega'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación shadcn: sin factura/guía */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar sin documentos</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a registrar una entrega <b>sin factura ni guía</b>. ¿Deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSubmitWithoutDocs}>
              Sí, continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
