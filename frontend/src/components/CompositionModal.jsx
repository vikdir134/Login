import { useEffect, useMemo, useState } from "react"
import api from "../api/axios"

/* shadcn */
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"

/* Reutilizable */
import SearchCombobox from "@/components/SearchCombobox"

const ZONAS = ["TRONCO", "ALMA", "CUBIERTA"]

/**
 * Props:
 * - open: bool
 * - onClose: fn
 * - productId: number | null (si viene, se fija y no se muestra el selector de productos)
 * - onDone: fn (se llama al guardar OK)
 */
export default function CompositionModal({ open, onClose, productId, onDone }) {
  // estado UI
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState("")

  // datos catálogo
  const [materials, setMaterials] = useState([]) // MP
  const [products, setProducts]   = useState([]) // productos sin composición

  // selección de producto (cuando no viene por props)
  const [selectedProductId, setSelectedProductId] = useState(productId ?? undefined)

  // filas de composición
  const [rows, setRows] = useState([{ primaterId: undefined, zone: "TRONCO", percentage: "" }])

  // helpers
  const theProductId = productId || Number(selectedProductId) || null
  const totalPercent = useMemo(
    () => rows.reduce((a, r) => a + Number(r.percentage || 0), 0),
    [rows]
  )

  const canSubmit = useMemo(() => {
    if (!theProductId) return false
    if (!Array.isArray(rows) || rows.length === 0) return false
    for (const r of rows) {
      if (!r.primaterId) return false
      if (!ZONAS.includes(String(r.zone))) return false
      if (!(Number(r.percentage) > 0)) return false
    }
    return totalPercent <= 100 + 1e-9
  }, [rows, theProductId, totalPercent])

  // efectos
  useEffect(() => {
    if (!open) return
    setMsg("")
    setRows([{ primaterId: undefined, zone: "TRONCO", percentage: "" }])

    if (!productId) {
      api.get("/api/products/without-composition", { params: { limit: 1000 } })
        .then(r => setProducts(Array.isArray(r.data) ? r.data : []))
        .catch(() => setProducts([]))
      setSelectedProductId(undefined)
    } else {
      setSelectedProductId(productId)
    }

    api.get("/api/primary-materials", { params: { limit: 2000 } })
      .then(r => setMaterials(Array.isArray(r.data) ? r.data : []))
      .catch(() => setMaterials([]))
  }, [open, productId])

  // handlers
  const addRow = () => setRows(rs => [...rs, { primaterId: undefined, zone: "TRONCO", percentage: "" }])
  const setRow = (idx, patch) => setRows(rs => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  const removeRow = (idx) => setRows(rs => rs.filter((_, i) => i !== idx))

  const submit = async (e) => {
    e?.preventDefault?.()
    if (!canSubmit || !theProductId) return
    setSending(true); setMsg("")
    try {
      const payload = {
        items: rows.map(r => ({
          primaterId: Number(r.primaterId),
          zone: r.zone,
          percentage: Number(r.percentage)
        }))
      }
      await api.put(`/api/products/${theProductId}/composition`, payload)
      onDone?.()
      onClose?.()
    } catch (err) {
      setMsg(err.response?.data?.error || "Error guardando composición")
    } finally {
      setSending(false)
    }
  }

  // options para SearchCombobox
  const productOptions = products.map(p => ({
    id: p.id,
    label: p.name || p.DESCRIPCION || `Producto #${p.id}`
  }))

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
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Componer producto</DialogTitle>
          <DialogDescription className="sr-only">
            Define las materias primas y porcentajes que componen un producto.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {/* Selector de producto (solo si no viene por props) */}
          {!productId && (
            <div className="space-y-1.5">
              <Label>Producto (sin composición)</Label>
              <SearchCombobox
                value={selectedProductId}
                onChange={(v) => setSelectedProductId(v)}
                options={productOptions}
                getValue={(o) => String(o.id)}
                getLabel={(o) => o.label}
                placeholder="Buscar producto…"
                emptyMessage="Sin resultados"
              />
            </div>
          )}

          <div className="text-sm text-muted-foreground">Filas de composición</div>

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
                <Select value={r.zone} onValueChange={(v) => setRow(i, { zone: v })}>
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
                {rows.length > 1 && (
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
              Total: <b>{totalPercent.toFixed(2)}%</b> (debe ser ≤ 100%)
            </div>
          </div>

          {!!msg && <div className="text-destructive">{msg}</div>}

          <DialogFooter className="gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={!canSubmit || sending}>
              {sending ? "Guardando…" : "Guardar composición"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
