// frontend/src/components/AddPTModal.jsx
import { useEffect, useMemo, useState } from "react"
import {
  fetchProductsLite,
  fetchPrimaryMaterialsLite,
  createFinishedInput,
} from "../api/stock"
import { getProductComposition } from "../api/almacen"
import { toast } from "sonner"

/* shadcn */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
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

const fmt = (n) => (Number(n) || 0).toFixed(2)

/* ───────── Combobox reutilizable ───────── */
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
              <div className="truncate text-left">
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

/* ───────── Helpers ───────── */
const getMaterialLabel = (m) => {
  const id = m?.id ?? m?.ID_PRIMATER
  const mat = m?.material ?? m?.MATERIAL ?? ""
  const col = m?.color ?? m?.COLOR ?? ""
  const ds = m?.descripcion ?? m?.DESCRIPCION ?? ""
  const parts = [mat, col && `/${col}`, ds && `· ${ds}`].filter(Boolean)
  const name = parts.join(" ")
  return name ? `${name}` : `MP #${id}`
}

/* ───────── Componente principal ───────── */
export default function AddPTModal({ open, onClose, defaultZoneId, onDone }) {
  const [products, setProducts] = useState([])
  const [materials, setMaterials] = useState([])

  const [productId, setProductId] = useState("")
  const [peso, setPeso] = useState("")
  const [presentationKg, setPresentationKg] = useState("")
  const [composition, setComposition] = useState([]) // [{primaterId, zone, percentage}]
  const [useComposition, setUseComposition] = useState(true)

  const [consumos, setConsumos] = useState([{ primaterId: "", peso: "" }])
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState("")

  // confirmación cuando NO hay presentación
  const [confirmNoPresentation, setConfirmNoPresentation] = useState(false)
  const [pendingSubmit, setPendingSubmit] = useState(false) // si el click venía de submit

  useEffect(() => {
    if (!open) return
    setMsg("")
    fetchProductsLite().then(setProducts).catch(() => setProducts([]))
    fetchPrimaryMaterialsLite(1000)
      .then(setMaterials)
      .catch(() => setMaterials([]))

    // reset al abrir
    setProductId("")
    setPeso("")
    setPresentationKg("")
    setComposition([])
    setUseComposition(true)
    setConsumos([{ primaterId: "", peso: "" }])
    setConfirmNoPresentation(false)
    setPendingSubmit(false)
  }, [open])

  // cargar composición
  useEffect(() => {
    if (!productId) {
      setComposition([])
      setUseComposition(false)
      return
    }
    getProductComposition(productId)
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : []
        setComposition(list)
        setUseComposition(list.length > 0)
      })
      .catch(() => {
        setComposition([])
        setUseComposition(false)
      })
  }, [productId])

  // auto-consumos desde composición
  const autoConsumptions = useMemo(() => {
    const total = Number(peso || 0)
    if (!total || !composition.length) return []
    return composition.map((c) => {
      const primId = Number(c.primaterId || c.ID_PRIMATER)
      const perc = Number(c.percentage || c.PERCENTAGE || 0)
      const zone = String(c.zone || c.ZONE || "PRODUCCION")
      const qty = +(total * (perc / 100)).toFixed(2)
      const mp = materials.find((m) => (m.id ?? m.ID_PRIMATER) === primId)
      const mpLabel = mp ? getMaterialLabel(mp) : `MP #${primId}`
      return { primaterId: primId, zone, percentage: perc, qty, mpLabel }
    })
  }, [peso, composition, materials])

  const manualSum = useMemo(
    () => consumos.reduce((a, c) => a + Number(c.peso || 0), 0),
    [consumos]
  )

  // Validaciones core
  const pesoOk = Number(peso) > 0
  const consumosValidos =
    !useComposition
      ? (
          consumos.length > 0 &&
          consumos.every((c) => c.primaterId && Number(c.peso) > 0) &&
          manualSum - Number(peso) <= 1e-9
        )
      : true

  const canSubmit = useMemo(() => {
    if (!productId || !defaultZoneId) return false
    if (!pesoOk) return false
    if (!consumosValidos) return false
    return true
  }, [productId, defaultZoneId, pesoOk, consumosValidos])

  // acción final de crear
  const doCreate = async () => {
    setSending(true)
    setMsg("")
    try {
      const payload = {
        productId: Number(productId),
        peso: Number(peso),
        useComposition: !!useComposition,
      }
      if (Number(presentationKg) > 0) {
        payload.presentationKg = Number(presentationKg)
      }
      if (!useComposition) {
        payload.consumos = consumos.map((c) => ({
          primaterId: Number(c.primaterId),
          peso: Number(c.peso),
        }))
      }
      await createFinishedInput(payload)
      toast.success("Producto ingresado correctamente")
      onDone?.()
      onClose?.()
    } catch (err) {
      const errorMsg = err?.response?.data?.error || "Error al ingresar PT"
      setMsg(errorMsg)
      toast.error(errorMsg)
    } finally {
      setSending(false)
      setPendingSubmit(false)
    }
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) {
      if (!productId) setMsg("Selecciona un producto.")
      else if (!pesoOk) setMsg("Ingresa el peso total (kg).")
      else if (!consumosValidos) setMsg("Revisa los consumos de MP (faltan datos o superan el peso).")
      return
    }

    // Si NO hay presentación -> pedimos confirmación shadcn antes de enviar
    if (!(Number(presentationKg) > 0)) {
      setPendingSubmit(true)
      setConfirmNoPresentation(true)
      return
    }

    // Con presentación válida, crear directo
    doCreate()
  }

  const addConsumo = () =>
    setConsumos((cs) => [...cs, { primaterId: "", peso: "" }])
  const setConsumo = (i, patch) =>
    setConsumos((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  const removeConsumo = (i) =>
    setConsumos((cs) => cs.filter((_, idx) => idx !== i))

  // Opciones combobox
  const productOptions = products.map((p) => ({
    value: String(p.id),
    label: p.name || p.DESCRIPCION || `Producto #${p.id}`,
  }))
  const materialOptions = materials.map((m) => ({
    value: String(m.id ?? m.ID_PRIMATER),
    label: getMaterialLabel(m),
  }))

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ingresar Producto Terminado</DialogTitle>
            <DialogDescription className="sr-only">
              Formulario para ingresar producto terminado
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="grid gap-3">
            {/* PRODUCTO */}
            <SearchCombobox
              label="Producto"
              value={productId}
              onChange={setProductId}
              options={productOptions}
              placeholder="Buscar producto…"
            />

            {/* Peso & Presentación */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Peso total (kg)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={peso}
                  onChange={(e) => setPeso(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-1.5">
                <Label>
                  Presentación (kg) <span className="text-xs text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={presentationKg}
                  onChange={(e) => setPresentationKg(e.target.value)}
                  placeholder="Dejar vacío si no aplica"
                />
                {Number(presentationKg) > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Se registrará como “{fmt(presentationKg)} kg”.
                  </div>
                )}
              </div>
            </div>

            {/* Usar composición */}
            <label className="pretty-switch mt-1">
              <input
                type="checkbox"
                checked={useComposition}
                onChange={(e) => setUseComposition(e.target.checked)}
                disabled={!composition.length}
              />
              <span className="pretty-switch__slider" />
              Usar composición del producto (si existe)
            </label>

            {/* Vista de composición automática */}
            {useComposition && composition.length > 0 && (
              <Card className="p-3 border-dashed">
                <div className="text-sm text-muted-foreground mb-2">
                  Consumo automático (desde zona indicada, por defecto Producción):
                </div>
                <div className="grid gap-2">
                  <div className="grid grid-cols-3 font-semibold text-sm">
                    <div>Materia prima</div>
                    <div>%</div>
                    <div>Consumo (kg)</div>
                  </div>
                  {autoConsumptions.map((c, i) => (
                    <div key={i} className="grid grid-cols-3 items-center">
                      <div>
                        {c.mpLabel}{" "}
                        <span className="text-muted-foreground">({c.zone})</span>
                      </div>
                      <div>{fmt(c.percentage)}%</div>
                      <div>{fmt(c.qty)}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Entradas manuales */}
            {!useComposition && (
              <div className="grid gap-2">
                <div className="text-sm text-muted-foreground">
                  Consumos de MP (manual). Suma actual:{" "}
                  <b>
                    {fmt(manualSum)} / {fmt(peso)} kg
                  </b>
                </div>

                {consumos.map((c, i) => {
                  const pesoValido = Number(c.peso) > 0
                  const mpValida = !!c.primaterId
                  return (
                    <div
                      key={i}
                      className="grid gap-3 sm:grid-cols-[1fr_180px_auto]"
                    >
                      <SearchCombobox
                        label="Materia Prima"
                        value={c.primaterId}
                        onChange={(id) => setConsumo(i, { primaterId: id })}
                        options={materialOptions}
                        placeholder="Buscar materia prima…"
                      />
                      <div className="grid gap-1.5">
                        <Label>Peso (kg)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={c.peso}
                          onChange={(e) => setConsumo(i, { peso: e.target.value })}
                          required
                        />
                        {!pesoValido && (
                          <div className="text-xs text-red-600">
                            Ingresa un peso mayor a 0
                          </div>
                        )}
                      </div>
                      <div className="flex items-end">
                        {consumos.length > 1 && (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => removeConsumo(i)}
                          >
                            Quitar
                          </Button>
                        )}
                      </div>
                      {!mpValida && (
                        <div className="text-xs text-red-600 sm:col-span-3 -mt-2">
                          Selecciona la materia prima
                        </div>
                      )}
                    </div>
                  )
                })}

                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={addConsumo}
                    size="sm"
                  >
                    + Consumo
                  </Button>
                </div>

                {manualSum - Number(peso) > 1e-9 && (
                  <div className="text-red-600 text-sm">
                    La suma manual no puede superar el peso total.
                  </div>
                )}
              </div>
            )}

            {/* Error general del backend (visible en rojo) */}
            {msg && (
              <div className="text-red-600 text-sm border border-red-200 rounded-md p-2">
                {msg}
              </div>
            )}

            <DialogFooter className="mt-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancelar
              </Button>
              <Button disabled={sending || !canSubmit}>
                {sending ? "Guardando…" : "Ingresar PT"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmación shadcn: no hay presentación */}
      <AlertDialog open={confirmNoPresentation} onOpenChange={setConfirmNoPresentation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar sin presentación</AlertDialogTitle>
            <AlertDialogDescription>
              No ingresaste la <b>Presentación (kg)</b>. ¿Deseas continuar de todas maneras?
              Puedes dejarla vacía si no aplica en tu empresa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingSubmit(false)
              }}
            >
              Volver
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmNoPresentation(false)
                if (pendingSubmit) doCreate()
              }}
            >
              Continuar y registrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
