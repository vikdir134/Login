// src/components/RemoveMermaModal.jsx
import { useEffect, useMemo, useState } from 'react'
import { removeMerma } from '@/api/stock'
import { toast } from 'sonner'

/* shadcn */
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function RemoveMermaModal({ open, onClose, row, onDone }) {
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)

  // confirmación “acción destructiva”
  const [askConfirm, setAskConfirm] = useState(false)
  const [pendingSubmit, setPendingSubmit] = useState(false)

  useEffect(() => {
    if (!open) return
    setQty(''); setNote(''); setMsg(''); setSending(false)
    setAskConfirm(false); setPendingSubmit(false)
  }, [open])

  // inferir tipo de ítem/ID
  const { type, itemId } = useMemo(() => {
    const type = (row?.type || row?.TIPO || '').toString().toUpperCase()
    if (type === 'PRIMARY') {
      const itemId = Number(row?.primaterId || row?.PRIMATER_ID || row?.ID_PRIMATER || row?.itemId)
      return { type: 'PRIMARY', itemId }
    }
    if (type === 'FINISHED') {
      const itemId = Number(row?.productId || row?.PRODUCT_ID || row?.ID_PRODUCT || row?.itemId)
      return { type: 'FINISHED', itemId }
    }
    const itemIdPM = Number(row?.primaterId || row?.ID_PRIMATER)
    if (itemIdPM) return { type: 'PRIMARY', itemId: itemIdPM }
    const itemIdPT = Number(row?.productId || row?.ID_PRODUCT)
    if (itemIdPT) return { type: 'FINISHED', itemId: itemIdPT }
    return { type: null, itemId: null }
  }, [row])

  const itemName = row?.name || row?.itemName || row?.DESCRIPCION || 'Ítem'
  const typeLabel = type === 'PRIMARY' ? 'Materia Prima' : (type === 'FINISHED' ? 'Producto Terminado' : '—')

  const canSubmit = !!type && !!itemId && Number(qty) > 0

  const doRemove = async () => {
    setSending(true); setMsg('')
    try {
      await removeMerma({ type, itemId, qty: Number(qty), note: note || undefined })
      toast.success('Merma descartada correctamente')
      onDone?.()
      onClose?.()
    } catch (err) {
      const e = err?.response?.data?.error || 'Error al descartar merma'
      setMsg(e)
      toast.error(e)
    } finally {
      setSending(false); setPendingSubmit(false)
    }
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) {
      if (!type || !itemId) setMsg('No se pudo identificar el ítem de merma')
      else if (!(Number(qty) > 0)) setMsg('Ingresa una cantidad válida (kg)')
      return
    }
    // acción destructiva → confirmación shadcn
    setPendingSubmit(true)
    setAskConfirm(true)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose?.() }}>
        {/* ancho grande + scroll interno */}
        <DialogContent className="w-[95vw] sm:max-w-xl p-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b">
            <DialogTitle>Descartar merma</DialogTitle>
          </DialogHeader>

          <form onSubmit={onSubmit}>
            <div className="px-6 pb-6 pt-4 space-y-4" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <div className="text-sm text-muted-foreground">
                {typeLabel}: <b>{itemName}</b>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Cantidad a descartar (kg)</Label>
                  <Input
                    type="number" step="0.01" min="0.01"
                    value={qty} onChange={(e) => setQty(e.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label>Nota (opcional)</Label>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motivo / referencia" />
                </div>
              </div>

              {msg && (
                <div className="text-sm text-red-600 border border-red-200 rounded-md p-2">
                  {msg}
                </div>
              )}
            </div>

            <DialogFooter className="px-6 py-4 border-t">
              <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
              <Button disabled={!canSubmit || sending}>{sending ? 'Procesando…' : 'Descartar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmación shadcn (no navegador) */}
      <AlertDialog open={askConfirm} onOpenChange={setAskConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar descarte</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a <b>descartar {Number(qty || 0).toFixed(2)} kg</b> de <b>{itemName}</b>.
              Esta acción afecta el stock. ¿Deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingSubmit(false)}>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setAskConfirm(false); if (pendingSubmit) doRemove() }}>
              Sí, descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
