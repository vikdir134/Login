// src/components/AddOrderLineDialog.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

// === Helpers básicos de búsqueda (mismos que ya usabas) ===
const normalize = (s = "") =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()

function filterStartsThenIncludes(options, query, getLabel) {
  const q = normalize(query)
  if (!q) return []
  const starts = []
  const includes = []
  for (const opt of options) {
    const l = normalize(getLabel(opt))
    if (l.startsWith(q)) starts.push(opt)
    else if (l.includes(q)) includes.push(opt)
  }
  return [...starts, ...includes]
}

function ProductAutocomplete({ value, display, onChange, options }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(display || "")
  const [hoverIdx, setHoverIdx] = useState(-1)
  const boxRef = useRef(null)

  useEffect(() => {
    const onDoc = (e) => {
      if (!boxRef.current) return
      if (!boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  useEffect(() => { setQuery(display || "") }, [display])

  const getLabel = (p) => p.name || p.DESCRIPCION || `Producto #${p.id}`
  const getKey = (p) => p.id

  const results = useMemo(() => {
    if (!query) return []
    return filterStartsThenIncludes(options, query, getLabel).slice(0, 20)
  }, [options, query])

  const choose = (opt) => {
    const id = getKey(opt)
    const text = getLabel(opt)
    onChange(id, text)
    setOpen(false)
  }

  const onKeyDown = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true)
      return
    }
    if (!open) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHoverIdx((i) => Math.min(results.length - 1, i + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHoverIdx((i) => Math.max(0, i - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const opt = results[hoverIdx] ?? results[0]
      if (opt) choose(opt)
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div className="grid gap-2" ref={boxRef} style={{ position: "relative" }}>
      <Label>Producto</Label>
      <Input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Escribe nombre/código…"
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <div
          className="rounded-md border bg-popover text-popover-foreground shadow-md"
          style={{
            position: "absolute", left: 0, right: 0, top: "100%", zIndex: 50,
            marginTop: 4, maxHeight: 280, overflow: "auto", padding: 6
          }}
        >
          {results.map((opt, idx) => (
            <div
              key={getKey(opt)}
              onMouseEnter={() => setHoverIdx(idx)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(opt)}
              className={
                "cursor-pointer rounded-md px-2 py-2 text-sm " +
                (idx === hoverIdx ? "bg-accent text-accent-foreground" : "")
              }
            >
              {getLabel(opt)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AddOrderLineDialog({
  open,
  onOpenChange,
  products = [],
  onSubmit, // ( {productId, peso, presentacion} ) => Promise<boolean>
}) {
  const [productId, setProductId] = useState("")
  const [productLabel, setProductLabel] = useState("")
  const [peso, setPeso] = useState("")
  const [presentacion, setPresentacion] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setProductId("")
      setProductLabel("")
      setPeso("")
      setPresentacion("")
      setSaving(false)
    }
  }, [open])

  const canSubmit =
    Number(productId) > 0 && Number(peso) > 0 && Number(presentacion) > 0 && !saving

  const handleConfirm = async () => {
    if (!canSubmit) return
    setSaving(true)
    const ok = await onSubmit({
      productId,
      peso,
      presentacion,
    })
    setSaving(false)
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar línea</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <ProductAutocomplete
            value={productId}
            display={productLabel}
            options={products}
            onChange={(id, label) => { setProductId(id); setProductLabel(label) }}
          />

          <div className="grid gap-2">
            <Label htmlFor="peso">Peso (kg)</Label>
            <Input
              id="peso"
              type="number"
              step="0.01"
              min="0.01"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pres">Presentación</Label>
            <Input
              id="pres"
              type="number"
              step="1"
              min="1"
              value={presentacion}
              onChange={(e) => setPresentacion(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canSubmit}>
            {saving ? "Guardando…" : "Agregar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
