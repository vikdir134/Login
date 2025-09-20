import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Plus, X } from "lucide-react"
import { createOrderApi } from "@/api/orders"
import { fetchCustomers } from "@/api/customers"
import api from "@/api/axios"

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogClose, DialogTrigger
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

import {
  Popover, PopoverTrigger, PopoverContent
} from "@/components/ui/popover"
import {
  Command, CommandInput, CommandItem, CommandList, CommandEmpty, CommandGroup
} from "@/components/ui/command"

function Combo({ value, onChange, options, getLabel, getKey, placeholder = "Buscar..." }) {
  const [open, setOpen] = useState(false)
  const label = useMemo(() => {
    const opt = options.find(o => getKey(o) === value)
    return opt ? getLabel(opt) : ""
  }, [options, value, getKey, getLabel])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span className="truncate">{label || placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[min(600px,92vw)]">
        <Command filter={(value, search, keywords) => {
          const v = (value || "").normalize("NFD").replace(/\p{Diacritic}/gu,'').toLowerCase()
          const s = (search || "").normalize("NFD").replace(/\p{Diacritic}/gu,'').toLowerCase()
          return v.startsWith(s) ? 1 : v.includes(s) ? 0.5 : 0
        }}>
          <CommandInput placeholder={placeholder} />
          <CommandList className="max-h-[320px]">
            <CommandEmpty>Sin resultados</CommandEmpty>
            <CommandGroup>
              {options.map(opt => (
                <CommandItem
                  key={getKey(opt)}
                  value={getLabel(opt)}
                  keywords={[String(getKey(opt))]}
                  onSelect={() => { onChange(getKey(opt), opt); setOpen(false) }}
                >
                  {getLabel(opt)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default function CreateOrderDialog({ open, onOpenChange, onCreated }) {
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])

  const [form, setForm] = useState({
    customerId: "",
    lines: [{ productId: "", peso: "", presentacion: "" }]
  })

  useEffect(() => {
    if (!open) return
    (async () => {
      try {
        const cs = await fetchCustomers({ q: "", limit: 1000 })
        setCustomers(Array.isArray(cs) ? cs : [])
      } catch { setCustomers([]) }

      try {
        const pRes = await api.get("/api/catalog/products?limit=1000").catch(()=>({ data: [] }))
        setProducts(Array.isArray(pRes.data) ? pRes.data : [])
      } catch { setProducts([]) }
    })()
  }, [open])

  const addLine = () => setForm(f => ({ ...f, lines: [...f.lines, { productId:"", peso:"", presentacion:"" }]}))
  const removeLine = (idx) => setForm(f => ({ ...f, lines: f.lines.filter((_,i)=>i!==idx) }))
  const setLine = (idx, patch) =>
    setForm(f => ({ ...f, lines: f.lines.map((ln,i)=> i===idx ? { ...ln, ...patch } : ln ) }))

  const canSubmit = useMemo(() => {
    if (!form.customerId) return false
    if (!form.lines.length) return false
    for (const l of form.lines) {
      if (!l.productId || Number(l.peso) <= 0 || Number(l.presentacion) <= 0) return false
    }
    return true
  }, [form])

  const customerLabel = (c) => `${c.razonSocial || c.RAZON_SOCIAL} — ${c.RUC}`
  const productLabel  = (p) => p.name || p.DESCRIPCION || `Producto #${p.id}`

  const submit = async () => {
    if (!canSubmit) return
    setSaving(true)
    try {
      const payload = {
        customerId: Number(form.customerId),
        lines: form.lines.map(l => ({
          productId: Number(l.productId),
          peso: Number(l.peso),
          presentacion: Number(l.presentacion)
        }))
      }
      await createOrderApi(payload)
      toast.success("Pedido creado")
      onOpenChange?.(false)
      onCreated?.()
      // reset
      setForm({ customerId:"", lines:[{ productId:"", peso:"", presentacion:"" }] })
    } catch (e) {
      toast.error(e?.response?.data?.error || "Error creando pedido")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>Nuevo pedido</DialogTitle>
          <DialogDescription>Completa la información y guarda para crear el pedido.</DialogDescription>
        </DialogHeader>

        {/* Cliente */}
        <div className="grid gap-2">
          <Label>Cliente</Label>
          <Combo
            value={form.customerId}
            onChange={(id)=> setForm(f=>({ ...f, customerId: id }))}
            options={customers}
            getLabel={customerLabel}
            getKey={(c)=> c.id}
            placeholder="Escribe RUC o Razón social…"
          />
        </div>

        <Separator />

        {/* Líneas */}
        <div className="text-sm text-muted-foreground">Líneas del pedido</div>
        <ScrollArea className="max-h-[45vh] pr-2">
          <div className="grid gap-3">
            {form.lines.map((ln, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                {/* Producto */}
                <div className="sm:col-span-6">
                  <Label>Producto</Label>
                  <Combo
                    value={ln.productId}
                    onChange={(id)=> setLine(idx, { productId:id })}
                    options={products}
                    getLabel={productLabel}
                    getKey={(p)=> p.id}
                    placeholder="Buscar producto…"
                  />
                </div>

                {/* Peso */}
                <div className="sm:col-span-2">
                  <Label>Peso (kg)</Label>
                  <Input
                    type="number" step="0.01" min="0.01"
                    value={ln.peso}
                    onChange={e=> setLine(idx, { peso: e.target.value })}
                  />
                </div>

                {/* Presentación */}
                <div className="sm:col-span-2">
                  <Label>Presentación</Label>
                  <Input
                    type="number" step="1" min="1"
                    value={ln.presentacion}
                    onChange={e=> setLine(idx, { presentacion: e.target.value })}
                  />
                </div>

                {/* Quitar */}
                <div className="sm:col-span-2 flex gap-2">
                  {form.lines.length > 1 && (
                    <Button type="button" variant="secondary" onClick={()=> removeLine(idx)} className="w-full">
                      <X className="h-4 w-4 mr-1" /> Quitar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex justify-between">
          <Button type="button" variant="secondary" onClick={addLine}>
            <Plus className="h-4 w-4 mr-1" /> Línea
          </Button>
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button onClick={submit} disabled={!canSubmit || saving}>
            {saving ? "Creando…" : "Crear pedido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
