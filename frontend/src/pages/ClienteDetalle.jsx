// src/pages/ClienteDetalle.jsx
import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"

/* Data */
import { fetchCustomerSummary } from "@/api/customers"
import { fetchCustomerReceivable } from "@/api/receivables"

/* shadcn UI */
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell
} from "@/components/ui/table"
import {
  Popover, PopoverTrigger, PopoverContent
} from "@/components/ui/popover"
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem
} from "@/components/ui/command"
import { Calendar } from "@/components/ui/calendar"
import { Check, ChevronsUpDown, Calendar as IconCalendar } from "lucide-react"
import { es } from "date-fns/locale"

/* Utils */
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—")
const fmtDateTime = (d) => new Date(d).toLocaleString()
const moneySymbol = (currency) => (currency === "PEN" ? "S/" : currency || "")
const fmtMoney = (n) => (Number(n) || 0).toFixed(2)

const STATE_OPTS = [
  { value: "ALL",        label: "Todos" },
  { value: "PENDIENTE",  label: "Pendiente" },
  { value: "EN_PROCESO", label: "En proceso" },
  { value: "ENTREGADO",  label: "Entregado" },
  { value: "CANCELADO",  label: "Cancelado" },
]

const EstadoBadge = ({ state }) => {
  const s = String(state || "").toUpperCase()
  if (s === "ENTREGADO")
    return <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-600/30" variant="outline">ENTREGADO</Badge>
  if (s === "EN_PROCESO")
    return <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-600/30" variant="outline">EN PROCESO</Badge>
  if (s === "PENDIENTE")
    return <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-600/30" variant="outline">PENDIENTE</Badge>
  if (s === "CANCELADO")
    return <Badge variant="secondary">CANCELADO</Badge>
  return <Badge variant="outline">{s || "—"}</Badge>
}

/* === Combobox shadcn para Estado === */
function StateCombobox({ value, onChange, options }) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value) || options[0]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selected?.label || "Selecciona estado"}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]">
        <Command>
          <CommandInput placeholder="Buscar estado…" />
          <CommandList>
            <CommandEmpty>Sin resultados</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const active = opt.value === value
                return (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}
                    onSelect={() => {
                      onChange(opt.value)
                      setOpen(false)
                    }}
                  >
                    <Check className={`mr-2 h-4 w-4 ${active ? "opacity-100" : "opacity-0"}`} />
                    {opt.label}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/* === Date picker igual al de Pedidos (dropdown mes/año) === */
function DateCell({ label, date, setDate }) {
  // Vamos a manejar aquí como string YYYY-MM-DD para integrarnos con este screen:
  // si llega string => convertir a Date
  const dateObj = date ? new Date(date) : undefined
  const fromYear = 2020
  const toYear = new Date().getFullYear() + 1

  const toYMD = (d) => {
    if (!d) return ""
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
  }

  return (
    <div className="grid gap-1">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start text-left font-normal">
            <IconCalendar className="mr-2 h-4 w-4" />
            {dateObj ? dateObj.toLocaleDateString() : <span>Selecciona fecha</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0" align="start">
          <Calendar
            mode="single"
            selected={dateObj}
            onSelect={(d) => setDate(d ? toYMD(d) : "")}
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

export default function ClienteDetalle() {
  const { id } = useParams()

  // Filtros
  const [q, setQ] = useState("")               // búsqueda rápida client-side (ID/fecha/total)
  const [stateSel, setStateSel] = useState("ALL")
  const [from, setFrom] = useState("")         // YYYY-MM-DD
  const [to, setTo] = useState("")             // YYYY-MM-DD

  // Paginación
  const [page, setPage] = useState(0)
  const pageSize = 10

  // Data
  const [info, setInfo] = useState(null)
  const [kpis, setKpis] = useState(null)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)

  // UI
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState("")

  const statesParam = useMemo(() => {
    if (stateSel === "ALL") return undefined
    return stateSel
  }, [stateSel])

  const load = async () => {
    setLoading(true); setMsg("")
    try {
      // Pedidos + KPIs operativos
      const data = await fetchCustomerSummary(id, {
        states: statesParam,
        from: from || undefined,
        to: to || undefined,
        limit: pageSize,
        offset: page * pageSize,
      })

      setInfo(data.customer || null)
      setRows(Array.isArray(data?.orders?.items) ? data.orders.items : [])
      setTotal(Number(data?.orders?.total || 0))

      // KPIs operativos base
      const baseKpis = data.kpis || {}

      // KPIs financieros (Pagado/Saldo)
      const recv = await fetchCustomerReceivable(id, { onlyWithBalance: false }).catch(() => null)
      setKpis({
        ...baseKpis,
        totalPagadoPEN: recv?.totalPagadoPEN ?? 0,
        saldoPEN: recv?.saldoPEN ?? Math.max(0, (baseKpis?.totalByCurrency?.PEN ?? 0) - 0),
      })
    } catch (e) {
      console.error(e)
      setMsg("Error cargando datos de cliente")
    } finally {
      setLoading(false)
    }
  }

  // Cargar cuando cambian filtros/página
  useEffect(() => { load() }, [id, statesParam, from, to, page])

  // Resetear página cuando cambien filtros
  useEffect(() => { setPage(0) }, [statesParam, from, to])

  // Filtro rápido client-side (sobre la página actual)
  const filteredRows = useMemo(() => {
    if (!q.trim()) return rows
    const term = q.trim().toLowerCase()
    return rows.filter((r) => {
      const idTxt = `#${r.id}`
      const fecha = fmtDateTime(r.fecha)
      const totalTxt = fmtMoney(r.total)
      return (
        idTxt.toLowerCase().includes(term) ||
        fecha.toLowerCase().includes(term) ||
        totalTxt.toLowerCase().includes(term)
      )
    })
  }, [q, rows])

  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize))
  const canPrev = page > 0
  const canNext = (page + 1) * pageSize < total

  if (loading && !info) return <section className="card">Cargando…</section>
  if (!info) return <section className="card">Cliente no encontrado</section>

  // KPI helpers (operativos)
  const lastDate = kpis?.lastOrderDate ? fmtDate(kpis.lastOrderDate) : "—"
  const ordersCount = kpis?.ordersCount ?? 0
  const fulfillment = kpis?.fulfillmentPct ?? 0
  const pendingCount = kpis?.pendingCount ?? 0
  const pedidoKg = kpis?.pedidoKg ?? 0
  const entregadoKg = kpis?.entregadoKg ?? 0

  // Monto acumulado (operativo)
  const penTotal = kpis?.totalByCurrency?.PEN ?? 0
  const otherCurrencies = Object.entries(kpis?.totalByCurrency || {}).filter(([c]) => c !== "PEN")

  // KPIs financieros
  const totalPagado = kpis?.totalPagadoPEN ?? 0
  const saldo = kpis?.saldoPEN ?? Math.max(0, penTotal - totalPagado)

  const avanceKgPct = pedidoKg ? Math.min(100, (entregadoKg / pedidoKg) * 100) : 0

  return (
    <section className="card">
      {/* Header — cliente más grande y en negrita */}
      <header className="flex items-center justify-between">
        <div>
          <h3 className="m-0 text-2xl font-bold">{info.razonSocial}</h3>
          <div className="muted">
            RUC: {info.RUC} ·{" "}
            {info.activo ? (
              <span className="text-green-700 dark:text-green-400 font-semibold">Activo</span>
            ) : (
              <span className="text-red-700 dark:text-red-400 font-semibold">Inactivo</span>
            )}
          </div>
        </div>
        <Button variant="secondary" asChild>
          <Link to={`/app/cxc/${id}`}>Cuentas por cobrar</Link>
        </Button>
      </header>

      {/* KPIs (versión original, “grandes”) */}
      <div
        className="mt-3"
        style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 12 }}
      >
        <Card><CardContent className="p-4">
          <div className="text-muted-foreground">Pedidos totales</div>
          <div className="text-2xl font-bold">{ordersCount}</div>
        </CardContent></Card>

        <Card><CardContent className="p-4">
          <div className="text-muted-foreground">Monto acumulado</div>
          <div className="text-2xl font-bold">
            {moneySymbol("PEN")} {fmtMoney(penTotal)}
          </div>
          {otherCurrencies.length > 0 && (
            <div className="text-muted-foreground mt-1 text-xs">
              {otherCurrencies.map(([c, v]) => `${moneySymbol(c)} ${fmtMoney(v)}`).join(" · ")}
            </div>
          )}
        </CardContent></Card>

        <Card><CardContent className="p-4">
          <div className="text-muted-foreground">Último pedido</div>
          <div className="text-2xl font-bold">{lastDate}</div>
        </CardContent></Card>

        <Card><CardContent className="p-4">
          <div className="text-muted-foreground">% cumplimiento</div>
          <div className="text-2xl font-bold">{fulfillment}%</div>
          <div className="text-muted-foreground text-xs">{pendingCount} pendientes</div>
        </CardContent></Card>

        <Card><CardContent className="p-4">
          <div className="text-muted-foreground">Pagado</div>
          <div className="text-2xl font-bold">S/ {fmtMoney(totalPagado)}</div>
        </CardContent></Card>

        <Card><CardContent className="p-4">
          <div className="text-muted-foreground">Saldo</div>
          <div className="text-2xl font-bold">S/ {fmtMoney(saldo)}</div>
        </CardContent></Card>
      </div>

      {/* Extra KPI: barra (Progress shadcn) */}
      <div className="mt-4">
        <div className="text-sm text-muted-foreground mb-1">Avance por kilos</div>
        <Progress value={avanceKgPct} />
        <div className="muted mt-1">
          Entregado: {fmtMoney(entregadoKg)} / {fmtMoney(pedidoKg)} kg
        </div>
      </div>

      {/* Filtros — calendario igual al de Pedidos */}
      <div
        className="mt-4"
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
          gap: 10,
          alignItems: "end",
        }}
      >
        <div className="form-field">
          <Label>Buscar</Label>
          <Input
            placeholder="Por ID, fecha (AAAA-MM-DD) o total…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="form-field">
          <Label>Estado</Label>
          <StateCombobox
            value={stateSel}
            onChange={(v) => setStateSel(v)}
            options={STATE_OPTS}
          />
        </div>

        <DateCell label="Desde" date={from} setDate={setFrom} />
        <DateCell label="Hasta" date={to} setDate={setTo} />

        <div className="form-field">
          <span>&nbsp;</span>
          <Button
            variant="secondary"
            onClick={() => {
              setFrom("")
              setTo("")
              setStateSel("ALL")
              setQ("")
            }}
          >
            Limpiar
          </Button>
        </div>
      </div>

      {/* Tabla pedidos (shadcn Table) */}
      <div className="rounded-md border mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && filteredRows.map((o) => (
              <TableRow key={o.id}>
                <TableCell>#{o.id}</TableCell>
                <TableCell>{fmtDateTime(o.fecha)}</TableCell>
                <TableCell>{moneySymbol(o.currency)} {fmtMoney(o.total)}</TableCell>
                <TableCell><EstadoBadge state={o.state || o.estado} /></TableCell>
                <TableCell className="text-right">
                  <Button variant="secondary" size="sm" asChild>
                    <Link to={`/app/pedidos/${o.id}`}>Ver</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}

            {loading && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">Cargando…</TableCell>
              </TableRow>
            )}
            {!loading && filteredRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">Sin pedidos</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginación simple */}
      <div className="flex items-center gap-2 mt-3">
        <Button variant="secondary" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
          Anterior
        </Button>
        <div className="muted">Página {page + 1} de {Math.max(1, Math.ceil((total || 0) / pageSize))}</div>
        <Button variant="secondary" disabled={(page + 1) * pageSize >= total} onClick={() => setPage((p) => p + 1)}>
          Siguiente
        </Button>
      </div>

      {msg && <div className="muted mt-2">{msg}</div>}
    </section>
  )
}
