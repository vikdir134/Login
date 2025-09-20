import { useEffect, useMemo, useState } from "react"
import api from "../api/axios"
import { createProduct, setProductComposition } from "../api/products"

/* shadcn */
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

/* Reutilizable */
import SearchCombobox from "@/components/SearchCombobox"

// Sugerencias:
const SUG_TIPOS = ["Driza", "Cabo", "Soga", "Cuerda", "Piola", "Trenza"]
const SUG_DIAM = ["2mm","3mm","4mm","6mm","8mm","10mm","12mm","14mm","16mm","3/16","1/4","5/16","7/16"]
const SUG_DESC_EJ = (tipo, diam, color="Blanco", material="Polipropileno") =>
  `${tipo || "Driza"} de ${material} ${diam || "3/16"} ${color}`

const ZONAS = ["TRONCO", "ALMA", "CUBIERTA"]

export default function CreateProductModal({ open, onClose, onDone }) {
  const [tipo, setTipo] = useState("")
  const [diameter, setDiameter] = useState("")
  const [descripcion, setDescripcion] = useState("")

  // composición opcional
  const [materials, setMaterials] = useState([])
  const [rows, setRows] = useState([]) // { primaterId, zone, percentage }
  const [useComp, setUseComp] = useState(false)

  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState("")

  useEffect(() => {
    if (!open) return
    setTipo(""); setDiameter(""); setDescripcion("")
    setRows([]); setUseComp(false); setMsg("")
    // catálogo MP para el combobox
    api.get("/api/primary-materials", { params: { limit: 2000 } })
      .then(r => setMaterials(Array.isArray(r.data) ? r.data : []))
      .catch(() => setMaterials([]))
  }, [open])

  const canCreate = tipo.trim() && diameter.trim() && descripcion.trim()
  const totalPct = useMemo(() => rows.reduce((a, r) => a + Number(r.percentage || 0), 0), [rows])
  const compOK = useMemo(
    () => (!useComp) ||
          (rows.length > 0 &&
           rows.every(r => r.primaterId && r.zone && Number(r.percentage) > 0) &&
           totalPct <= 100 + 1e-9),
    [useComp, rows, totalPct]
  )

  const fillSampleDescription = () => {
    setDescripcion(SUG_DESC_EJ(tipo, diameter))
  }

  const addRow = () => setRows(rs => [...rs, { primaterId: undefined, zone: "TRONCO", percentage: "" }])
  const setRow = (i, patch) => setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const removeRow = (i) => setRows(rs => rs.filter((_, idx) => idx !== i))

  const submit = async (e) => {
    e?.preventDefault?.()
    if (!canCreate || !compOK) return
    setSending(true); setMsg("")
    try {
      // 1) crear PT
      const prod = await createProduct({
        tipo: tipo.trim(),
        diameter: diameter.trim(),
        descripcion: descripcion.trim()
      })
      // 2) si hay composición, guardarla
      if (useComp && rows.length > 0) {
        await setProductComposition(prod.id, rows.map(r => ({
          primaterId: Number(r.primaterId),
          zone: r.zone,
          percentage: Number(r.percentage)
        })))
      }
      onDone?.()
      onClose?.()
    } catch (err) {
      setMsg(err.response?.data?.error || "Error creando producto")
    } finally {
      setSending(false)
    }
  }

  // options para MP
  const mpOptions = materials.map(m => {
    const id  = m.id || m.ID_PRIMATER
    const mat = m.material || m.MATERIAL || ""
    const col = m.color || m.COLOR || ""
    const des = m.descripcion || m.DESCRIPCION || ""
    const den = (m.denier || m.DENIER) ?? ""
    const denTxt = den !== "" ? ` · ${den}` : ""
    return { id, label: `${mat}${col ? " / " + col : ""}${des ? " · " + des : ""}${denTxt}` }
  })

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crear Producto Terminado</DialogTitle>
          <DialogDescription className="sr-only">
            Define los atributos del producto terminado y su composición opcional.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Input
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                placeholder="Ej. Driza"
                required
              />
              {/* Sugerencias rápidas */}
              <div className="flex flex-wrap gap-1">
                {SUG_TIPOS.map(s => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setTipo(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Diámetro</Label>
              <Input
                value={diameter}
                onChange={(e) => setDiameter(e.target.value)}
                placeholder="Ej. 7/16 o 12mm"
                required
              />
              <div className="flex flex-wrap gap-1">
                {SUG_DIAM.map(s => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setDiameter(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <div className="flex gap-2">
              <Input
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej. Driza de Polipropileno 3/16 Blanco"
                required
              />
              <Button type="button" variant="secondary" onClick={fillSampleDescription}>
                Sugerir
              </Button>
            </div>
          </div>

          {/* Toggle composición */}
          <div className="flex items-center gap-2">
            <Input
              id="chk-comp"
              type="checkbox"
              className="w-4 h-4"
              checked={useComp}
              onChange={(e) => setUseComp(e.target.checked)}
            />
            <Label htmlFor="chk-comp" className="font-semibold">Definir composición ahora (opcional)</Label>
          </div>

          {useComp && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Agrega las materias primas, zona y % (el total no debe exceder 100%).
              </div>

              {rows.map((r, i) => (
                <div key={i} className="grid md:grid-cols-[2fr_1fr_1fr_auto] gap-2 items-end">
                  <div className="space-y-1.5">
                    <Label>Materia prima</Label>
                    <SearchCombobox
                      value={r.primaterId}
                      onChange={(v) => setRow(i, { primaterId: v })}
                      options={mpOptions}
                      getValue={(o) => String(o.id)}
                      getLabel={(o) => o.label}
                      placeholder="Buscar MP…"
                      emptyMessage="Sin resultados"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Zona</Label>
                    <Select
                      value={r.zone}
                      onValueChange={(v) => setRow(i, { zone: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Zona" /></SelectTrigger>
                      <SelectContent>
                        {ZONAS.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>%</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="100"
                      value={r.percentage}
                      onChange={(e) => setRow(i, { percentage: e.target.value })}
                      required
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    {rows.length > 0 && (
                      <Button type="button" variant="secondary" onClick={() => removeRow(i)}>
                        Quitar
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              <div className="flex items-center gap-3">
                <Button type="button" variant="secondary" onClick={addRow}>+ Agregar MP</Button>
                <div className="text-sm text-muted-foreground">
                  Total: <b>{totalPct.toFixed(2)}%</b> (≤ 100%)
                </div>
              </div>
            </div>
          )}

          {!!msg && <div className="text-destructive">{msg}</div>}

          <DialogFooter className="gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={!canCreate || !compOK || sending}>
              {sending ? "Guardando…" : "Crear producto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
