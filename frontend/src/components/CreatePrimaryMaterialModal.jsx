import { useEffect, useMemo, useState } from "react"
import api from "../api/axios"

/* shadcn */
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

/* Reutilizable: mismo que usar para buscar cliente / crear pedido */
import SearchCombobox from "@/components/SearchCombobox"

export default function CreatePrimaryMaterialModal({ open, onClose, onDone }) {
  const [materials, setMaterials] = useState([])
  const [colors, setColors] = useState([])

  const [materialId, setMaterialId] = useState(undefined) // undefined => placeholder activo
  const [colorId, setColorId] = useState(undefined)       // opcional
  const [descripcion, setDescripcion] = useState("")
  const [denier, setDenier] = useState("")
  const [msg, setMsg] = useState("")
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return
    setMsg("")
    setMaterialId(undefined); setColorId(undefined); setDescripcion(""); setDenier("")
    api.get("/api/materials").then(r => setMaterials(r.data || [])).catch(() => setMaterials([]))
    api.get("/api/colors").then(r => setColors(r.data || [])).catch(() => setColors([]))
  }, [open])

  const canSubmit = useMemo(() => Number(materialId) > 0, [materialId])

  const submit = async (e) => {
    e?.preventDefault?.()
    if (!canSubmit) return
    setSending(true); setMsg("")
    try {
      await api.post("/api/primary-materials", {
        materialId: Number(materialId),
        colorId: colorId ? Number(colorId) : null,
        descripcion: descripcion || null,
        denier: denier ? Number(denier) : null
      })
      onDone?.()
      onClose?.()
    } catch (err) {
      setMsg(err.response?.data?.error || "Error creando MP")
    } finally { setSending(false) }
  }

  // helpers SearchCombobox
  const matOptions = materials.map(m => ({ id: m.id, label: m.name }))
  const colorOptions = colors.map(c => ({ id: c.id, label: c.name }))

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear Materia Prima</DialogTitle>
          <DialogDescription className="sr-only">
            Define material, color y atributos de la Materia Prima.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Material</Label>
            <SearchCombobox
              value={materialId}
              onChange={(v) => setMaterialId(v)}
              options={matOptions}
              getValue={(o) => String(o.id)}
              getLabel={(o) => o.label}
              placeholder="Buscar material…"
              emptyMessage="Sin resultados"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Color (opcional)</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <SearchCombobox
                  value={colorId}
                  onChange={(v) => setColorId(v)}
                  options={colorOptions}
                  getValue={(o) => String(o.id)}
                  getLabel={(o) => o.label}
                  placeholder="Buscar color…"
                  emptyMessage="Sin resultados"
                />
              </div>
              {colorId && (
                <Button type="button" variant="secondary" onClick={() => setColorId(undefined)}>
                  Limpiar
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descripción (opcional)</Label>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="e.g. Rafia" />
          </div>

          <div className="space-y-1.5">
            <Label>Denier (opcional)</Label>
            <Input type="number" step="1" min="0" value={denier} onChange={(e) => setDenier(e.target.value)} />
          </div>

          {!!msg && <div className="text-destructive">{msg}</div>}

          <DialogFooter className="gap-2">
            <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={!canSubmit || sending}>
              {sending ? "Guardando…" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
