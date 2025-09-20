// frontend/src/components/AddMermaModal.jsx
import { useEffect, useMemo, useState } from "react"
import api from "../api/axios"

/* shadcn */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import { ChevronsUpDown, Check } from "lucide-react"

/* Combobox reutilizable */
function SearchCombobox({
  value,
  onChange,
  options,
  placeholder = "Escribe para buscar…",
  emptyText = "Sin resultados",
  label,
}) {
  const [open, setOpen] = useState(false)
  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value)),
    [options, value]
  )

  return (
    <div className="w-full">
      {label && <Label className="mb-2 inline-block">{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selected ? (
              <div className="truncate">
                <div className="font-medium">{selected.label}</div>
                {selected.subLabel && (
                  <div className="text-xs text-muted-foreground truncate">
                    {selected.subLabel}
                  </div>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]">
          <Command shouldFilter={true}>
            <CommandInput placeholder={placeholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => {
                  const active = String(opt.value) === String(value)
                  return (
                    <CommandItem
                      key={opt.value}
                      value={opt.label + " " + (opt.subLabel || "")}
                      onSelect={() => {
                        onChange?.(String(opt.value))
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${
                          active ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      <div className="truncate">
                        <div className="font-medium">{opt.label}</div>
                        {opt.subLabel && (
                          <div className="text-xs text-muted-foreground truncate">
                            {opt.subLabel}
                          </div>
                        )}
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default function AddMermaModal({ open, onClose, onDone }) {
  const [source, setSource] = useState("PRIMARY") // PRIMARY | FINISHED
  const [from, setFrom] = useState("PRODUCCION") // RECEPCION | PRODUCCION | ALMACEN
  const [itemId, setItemId] = useState("")
  const [qty, setQty] = useState("")
  const [note, setNote] = useState("")
  const [msg, setMsg] = useState("")

  const [mpCatalog, setMpCatalog] = useState([])
  const [ptCatalog, setPtCatalog] = useState([])

  useEffect(() => {
    if (!open) return
    setMsg("")

    api
      .get("/api/primary-materials?limit=1000")
      .then((r) => setMpCatalog(Array.isArray(r.data) ? r.data : []))
      .catch(() => setMpCatalog([]))

    api
      .get("/api/catalog/products?limit=1000")
      .then((r) => setPtCatalog(Array.isArray(r.data) ? r.data : []))
      .catch(() => setPtCatalog([]))
  }, [open])

  const reset = () => {
    setSource("PRIMARY")
    setFrom("PRODUCCION")
    setItemId("")
    setQty("")
    setNote("")
    setMsg("")
  }

  const submit = async (e) => {
    e.preventDefault()
    setMsg("")
    if (!itemId || !(Number(qty) > 0)) {
      setMsg("Completa los campos")
      return
    }
    try {
      await api.post("/api/stock/merma/add", {
        source,
        from,
        itemId: Number(itemId),
        qty: Number(qty),
        note: note || null,
      })
      onDone?.()
      reset()
      onClose?.()
    } catch (err) {
      setMsg(err.response?.data?.error || "Error agregando merma")
    }
  }

  const mpOptions = useMemo(
    () =>
      mpCatalog.map((m) => ({
        value: String(m.id || m.ID_PRIMATER),
        label: m.descripcion || m.DESCRIPCION || "MP",
        subLabel: [m.material || m.MATERIAL, m.color || m.COLOR]
          .filter(Boolean)
          .join(" / ") || undefined,
      })),
    [mpCatalog]
  )

  const ptOptions = useMemo(
    () =>
      ptCatalog.map((p) => ({
        value: String(p.id),
        label: p.name || p.DESCRIPCION || `Producto #${p.id}`,
      })),
    [ptCatalog]
  )

  const itemOptions = source === "PRIMARY" ? mpOptions : ptOptions

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar merma</DialogTitle>
          <DialogDescription className="sr-only">
            Registra merma desde materia prima o producto terminado
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-2">
            <Label>Tipo de origen</Label>
            <Select value={source} onValueChange={(v) => { setSource(v); setItemId("") }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRIMARY">Materia prima</SelectItem>
                <SelectItem value="FINISHED">Producto terminado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Zona de origen</Label>
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RECEPCION">Recepción (MP)</SelectItem>
                <SelectItem value="PRODUCCION">Producción (MP)</SelectItem>
                <SelectItem value="ALMACEN">Almacén (PT)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Ítem (combobox con búsqueda integrada) */}
          <SearchCombobox
            label={source === "PRIMARY" ? "Materia prima" : "Producto terminado"}
            value={itemId}
            onChange={setItemId}
            options={itemOptions}
            placeholder={
              source === "PRIMARY"
                ? "Buscar materia prima…"
                : "Buscar producto terminado…"
            }
          />

          <div className="grid gap-2">
            <Label>Peso (kg)</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label>Nota</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          {msg && <div className="text-red-600 text-sm">{msg}</div>}

          <DialogFooter className="mt-1">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button>Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
