// frontend/src/components/MoveMPModal.jsx
import { useEffect, useMemo, useState } from "react"
import { movePrimary, fetchPrimaryMaterialsLite } from "../api/stock"

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

export default function MoveMPModal({ open, onClose, onDone, defaultFrom }) {
  const [from, setFrom] = useState(defaultFrom || "RECEPCION")
  const [to, setTo] = useState(from === "RECEPCION" ? "PRODUCCION" : "RECEPCION")
  const [materials, setMaterials] = useState([])
  const [primaterId, setPrimaterId] = useState("")
  const [qty, setQty] = useState("")
  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState("")

  useEffect(() => {
    if (!open) return
    const f = defaultFrom || "RECEPCION"
    setFrom(f)
    setTo(f === "RECEPCION" ? "PRODUCCION" : "RECEPCION")
    setPrimaterId("")
    setQty("")
    setNote("")
    setMsg("")
    fetchPrimaryMaterialsLite(1000)
      .then(setMaterials)
      .catch(() => setMaterials([]))
  }, [open, defaultFrom])

  const canSubmit =
    ["RECEPCION", "PRODUCCION"].includes(from) &&
    ["RECEPCION", "PRODUCCION"].includes(to) &&
    from !== to &&
    Number(primaterId) > 0 &&
    Number(qty) > 0

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSending(true)
    setMsg("")
    try {
      await movePrimary({
        from,
        to,
        primaterId: Number(primaterId),
        qty: Number(qty),
        note: note || null,
      })
      onDone?.()
      onClose?.()
    } catch (err) {
      setMsg(err.response?.data?.error || "Error moviendo MP")
    } finally {
      setSending(false)
    }
  }

  const materialOptions = useMemo(
    () =>
      materials.map((m) => {
        const id = m.id || m.ID_PRIMATER
        const desc = m.descripcion || m.DESCRIPCION || ""
        const mat = m.material || m.MATERIAL || ""
        const col = m.color || m.COLOR || ""
        return {
          value: String(id),
          label: `${mat}${col ? " / " + col : ""}`,
          subLabel: desc || undefined,
        }
      }),
    [materials]
  )

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover Materia Prima</DialogTitle>
          <DialogDescription className="sr-only">
            Formulario para mover materia prima entre zonas
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>De</Label>
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RECEPCION">RECEPCION</SelectItem>
                  <SelectItem value="PRODUCCION">PRODUCCION</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>A</Label>
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRODUCCION">PRODUCCION</SelectItem>
                  <SelectItem value="RECEPCION">RECEPCION</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* MP (combobox con búsqueda integrada) */}
          <SearchCombobox
            label="Materia prima"
            value={primaterId}
            onChange={setPrimaterId}
            options={materialOptions}
            placeholder="Buscar materia prima…"
          />

          <div className="grid gap-2">
            <Label>Cantidad (kg)</Label>
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
            <Label>Nota (opcional)</Label>
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
            <Button disabled={!canSubmit || sending}>
              {sending ? "Moviendo…" : "Mover"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
