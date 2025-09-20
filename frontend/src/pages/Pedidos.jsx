import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Plus, Calendar as CalendarIcon, Check, ChevronsUpDown } from "lucide-react"
import { es } from "date-fns/locale"

import { listOrdersCombined } from "@/api/orders"
import { hasRole, getUserFromToken } from "@/utils/auth"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious, PaginationLink } from "@/components/ui/pagination"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"

import CreateOrderDialog from "@/components/CreateOrderDialog"

// Helpers
const EstadoBadge = ({ state }) => {
  const s = String(state || "").toUpperCase()
  if (s === "ENTREGADO") return <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-600/30" variant="outline">ENTREGADO</Badge>
  if (s === "EN_PROCESO") return <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-600/30" variant="outline">EN PROCESO</Badge>
  if (s === "PENDIENTE") return <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-600/30" variant="outline">PENDIENTE</Badge>
  if (s === "CANCELADO") return <Badge variant="secondary">CANCELADO</Badge>
  return <Badge variant="outline">{s}</Badge>
}

const toYMD = (d) => {
  if (!d) return undefined
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

// Opciones de estado para el combobox
const ESTADOS = [
  { label: "Todos", value: "" },
  { label: "PENDIENTE", value: "PENDIENTE" },
  { label: "EN_PROCESO", value: "EN_PROCESO" },
  { label: "ENTREGADO", value: "ENTREGADO" },
  { label: "CANCELADO", value: "CANCELADO" },
]

export default function Pedidos() {
  const me = getUserFromToken()
  const puedeCrear = hasRole(me, "PRODUCCION") || hasRole(me, "JEFE") || hasRole(me, "ADMINISTRADOR")

  // filtros
  const [q, setQ] = useState("")
  const [state, setState] = useState("")
  const [from, setFrom] = useState(undefined) // Date | undefined
  const [to, setTo] = useState(undefined)     // Date | undefined

  // tabla
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)

  // paginado
  const pageSize = 30
  const [page, setPage] = useState(0)
  const totalPages = useMemo(() => Math.max(1, Math.ceil((total || 0) / pageSize)), [total])
  const canPrev = page > 0
  const canNext = page + 1 < totalPages

  const load = async () => {
    setLoading(true)
    try {
      const data = await listOrdersCombined({
        q: q || undefined,
        state: state || undefined,
        from: from ? toYMD(from) : undefined,
        to:   to   ? toYMD(to)   : undefined,
        limit: pageSize,
        offset: page * pageSize,
      })
      setRows(Array.isArray(data?.items) ? data.items : [])
      setTotal(Number(data?.total || 0))
    } catch {
      setRows([]); setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  // reactividad
  useEffect(() => { setPage(0) }, [q, state, from, to])
  useEffect(() => { load() }, [q, state, from, to, page]) // eslint-disable-line

  // Dialog crear
  const [openCreate, setOpenCreate] = useState(false)

  return (
    <Card className="w-full">
      <CardHeader className="flex items-center justify-between space-y-0">
        <CardTitle className="text-xl">Pedidos</CardTitle>
        {puedeCrear && (
          <Button onClick={() => setOpenCreate(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo pedido
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-1">
            <Label>Buscar (cliente/RUC)</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Texto…" />
          </div>

          <div className="md:col-span-1">
            <Label>Estado</Label>
            <EstadoCombobox value={state} onChange={setState} />
          </div>

          <DateCell label="Desde" date={from} setDate={setFrom} />
          <DateCell label="Hasta" date={to} setDate={setTo} />
        </div>

        {/* Tabla */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{new Date(row.fecha).toLocaleString()}</TableCell>
                  <TableCell>{row.customerName}</TableCell>
                  <TableCell><EstadoBadge state={row.state} /></TableCell>
                  <TableCell className="text-right">
                    <Button variant="secondary" size="sm" asChild>
                      <Link to={`/app/pedidos/${row.id}`}>Ver</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {loading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">Cargando…</TableCell>
                </TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">Sin resultados</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Paginación */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages}
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious onClick={() => canPrev && setPage((p) => p - 1)} aria-disabled={!canPrev} />
              </PaginationItem>
              {Array.from({ length: totalPages })
                .slice(Math.max(0, page - 1), Math.min(totalPages, page + 2))
                .map((_, idx) => {
                  const p = Math.max(0, page - 1) + idx
                  return (
                    <PaginationItem key={p}>
                      <PaginationLink isActive={p === page} onClick={() => setPage(p)}>{p + 1}</PaginationLink>
                    </PaginationItem>
                  )
                })}
              <PaginationItem>
                <PaginationNext onClick={() => canNext && setPage((p) => p + 1)} aria-disabled={!canNext} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </CardContent>

      {/* Dialog crear */}
      <CreateOrderDialog open={openCreate} onOpenChange={setOpenCreate} onCreated={load} />
    </Card>
  )
}

// --- Combobox shadcn inline para estado ---
function EstadoCombobox({ value, onChange }) {
  const selected = ESTADOS.find((e) => e.value === value) ?? ESTADOS[0]
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between">
          {selected.label}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[220px]">
        <Command>
          <CommandInput placeholder="Filtrar estado…" />
          <CommandEmpty>Sin coincidencias.</CommandEmpty>
          <CommandGroup>
            {ESTADOS.map((opt) => (
              <CommandItem
                key={opt.value || 'ALL'}
                value={opt.label}
                onSelect={() => { onChange(opt.value); setOpen(false) }}
                className="flex items-center gap-2"
              >
                <Check className={`h-4 w-4 ${opt.value === value ? 'opacity-100' : 'opacity-0'}`} />
                {opt.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// --- Subcomponente: picker de fecha individual (con dropdown Mes/Año) ---
function DateCell({ label, date, setDate }) {
  const fromYear = 2020
  const toYear = new Date().getFullYear() + 1

  return (
    <div>
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start text-left font-normal">
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? date.toLocaleDateString() : <span>Selecciona fecha</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            initialFocus
            captionLayout="dropdown"
            fromYear={fromYear}
            toYear={toYear}
            locale={es}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
