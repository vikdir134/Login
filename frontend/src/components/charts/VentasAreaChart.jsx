// src/components/charts/VentasAreaChart.jsx
// Requisitos:
//  - Tailwind + shadcn/ui instalados
//  - Recharts: npm i recharts
//  - Axios ya lo usas en el proyecto

import * as React from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  Tooltip,
} from "recharts"
import { useIsMobile } from "@/hooks/use-mobile"
import axios from "axios"

// ⛑️ Mientras verificamos el render, usamos MOCK por defecto.
// Cuando me confirmes el endpoint real, cambia a false.
const USE_MOCK = true

export default function VentasAreaChart({ title = "Ventas (CxC)" }) {
  const isMobile = useIsMobile()
  const [range, setRange] = React.useState("30d") // "30d" | "12m" | "years"
  const [rows, setRows] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    if (isMobile) setRange("30d")
  }, [isMobile])

  React.useEffect(() => {
    let ignore = false
    ;(async () => {
      setLoading(true)
      setError("")
      try {
        const data = USE_MOCK ? mockVentas(range) : await loadVentas(range)
        if (!ignore) setRows(data)
      } catch (e) {
        console.error("[VentasAreaChart] load error:", e)
        if (!ignore) {
          setError("No se pudo cargar ventas. Mostrando datos de ejemplo.")
          setRows(mockVentas(range))
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    })()
    return () => {
      ignore = true
    }
  }, [range])

  const chartTitle =
    range === "30d"
      ? `${title} · últimos 30 días`
      : range === "12m"
      ? `${title} · últimos 12 meses`
      : `${title} · últimos 5 años`

  return (
    <Card>
      {/* Header con layout similar al ejemplo: título a la izquierda, controles a la derecha */}
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle>{chartTitle}</CardTitle>
          <CardDescription>
            Serie diaria / mensual / anual según rango
          </CardDescription>
        </div>

        {/* Controles con “espacio de sobra” (padding + borde redondeado) */}
        <div className="flex items-center gap-2">
          {/* Desktop: segmented control */}
          <ToggleGroup
            type="single"
            value={range}
            onValueChange={(v) => v && setRange(v)}
            aria-label="Rango de ventas"
            className="hidden sm:inline-flex items-center gap-1 rounded-full border bg-card px-2 py-1 shadow-sm"
          >
            <ToggleGroupItem
              value="30d"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm leading-none
                         data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              Ultimos 30 días   
            </ToggleGroupItem>
            <ToggleGroupItem
              value="12m"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm leading-none
                         data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              Ultimos 12 meses
            </ToggleGroupItem>
            <ToggleGroupItem
              value="years"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm leading-none
                         data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              Años
            </ToggleGroupItem>
          </ToggleGroup>

          {/* Móvil: select */}
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-44 sm:hidden" size="sm" aria-label="Seleccionar rango">
              <SelectValue placeholder="Últimos 30 días" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="30d" className="rounded-lg">Últimos 30 días</SelectItem>
              <SelectItem value="12m" className="rounded-lg">Últimos 12 meses</SelectItem>
              <SelectItem value="years" className="rounded-lg">Años</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="px-2 pt-2 sm:px-6 sm:pt-4">
        {/* Altura fija y ancho completo; borde suave como en el ejemplo */}
        <div className="h-[260px] w-full rounded-lg border">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows}>
              <defs>
                <linearGradient id="fillVentas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.9} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.12} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
              />
              <Tooltip cursor={false} content={<TooltipContent />} />
              <Area
                dataKey="ventas"
                type="natural"
                fill="url(#fillVentas)"
                stroke="var(--primary)"
                strokeWidth={1.25}
                stackId="a"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {loading && (
          <div className="mt-2 text-xs text-muted-foreground">Cargando…</div>
        )}
        {error && <div className="mt-2 text-xs text-red-500">{error}</div>}
      </CardContent>
    </Card>
  )
}

/** Tooltip minimalista compatible con dark/light */
function TooltipContent({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value ?? 0
  return (
    <div className="rounded-lg border bg-background/95 p-2 text-xs shadow-sm">
      <div className="font-medium">{label}</div>
      <div className="mt-1">
        Ventas: <span className="font-semibold">{formatMoney(v)}</span>
      </div>
    </div>
  )
}

/* =====================
 * Carga de datos reales (cuando USE_MOCK=false)
 * ===================== */
async function loadVentas(range) {
  const now = new Date()
  if (range === "30d") {
    const from = addDays(now, -29)
    const items = await fetchDeliveries({ from, to: now })
    return aggregateByDay(items, from, now).map(({ d, total }) => ({
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      ventas: round2(total),
    }))
  }
  if (range === "12m") {
    const from = addMonths(now, -11)
    const items = await fetchDeliveries({ from, to: now })
    return aggregateByMonth(items, from, now).map(({ y, m, total }) => ({
      label: new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short" }),
      ventas: round2(total),
    }))
  }
  const from = new Date(now.getFullYear() - 4, 0, 1)
  const items = await fetchDeliveries({ from, to: now })
  return aggregateByYear(items, from, now).map(({ y, total }) => ({
    label: String(y),
    ventas: round2(total),
  }))
}

/** Ajusta este fetch a TU backend cuando quites USE_MOCK */
async function fetchDeliveries({ from, to }) {
  // 🔁 Cambia la URL si tu backend no usa proxy.
  // Espera un array de objetos con fecha y monto (campos abajo se normalizan).
  const { data } = await axios.get(`/api/deliveries`, {
    params: { from: from.toISOString(), to: to.toISOString() },
  })
  return normalizeDeliveries(data)
}

function normalizeDeliveries(items) {
  if (!Array.isArray(items)) return []
  return items.map((d) => ({
    date: new Date(d.deliveryDate || d.fecha || d.createdAt || d.date),
    total: Number(d.total || d.monto || d.amount || 0),
  }))
}

/* =====================
 * Agregadores
 * ===================== */
function aggregateByDay(items, from, to) {
  const days = eachDay(from, to)
  const map = Object.create(null)
  for (const d of items) {
    const k = keyDay(d.date)
    map[k] = (map[k] || 0) + (d.total || 0)
  }
  return days.map((d) => ({ d, total: map[keyDay(d)] || 0 }))
}

function aggregateByMonth(items, from, to) {
  const months = eachMonth(from, to)
  const map = Object.create(null)
  for (const d of items) {
    const k = keyMonth(d.date)
    map[k] = (map[k] || 0) + (d.total || 0)
  }
  return months.map(({ y, m }) => ({ y, m, total: map[`${y}-${m}`] || 0 }))
}

function aggregateByYear(items, from, to) {
  const years = eachYear(from, to)
  const map = Object.create(null)
  for (const d of items) {
    const y = d.date.getFullYear()
    map[y] = (map[y] || 0) + (d.total || 0)
  }
  return years.map((y) => ({ y, total: map[y] || 0 }))
}

/* =====================
 * Utilidades de fechas
 * ===================== */
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function addMonths(d, n) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x }
function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x }
function keyDay(d) { const x = startOfDay(d); return x.toISOString().slice(0,10) }
function keyMonth(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }
function eachDay(from, to) { const a=[]; let cur=startOfDay(from); const end=startOfDay(to); while (cur<=end){ a.push(new Date(cur)); cur=addDays(cur,1)} return a }
function eachMonth(from, to) {
  const a=[]; let y=from.getFullYear(); let m=from.getMonth()+1
  const Y=to.getFullYear(); const M=to.getMonth()+1
  while (y < Y || (y === Y && m <= M)) { a.push({ y, m }); m++; if (m===13){ m=1; y++; } }
  return a
}
function eachYear(from, to) { const a=[]; for(let y=from.getFullYear(); y<=to.getFullYear(); y++) a.push(y); return a }
function round2(n) { return Math.round((Number(n)||0)*100)/100 }
function formatMoney(n) { return (Number(n)||0).toLocaleString(undefined, { style:'currency', currency:'PEN', maximumFractionDigits:2 }) }

/* =====================
 * Mock de respaldo
 * ===================== */
function mockVentas(range) {
  const now = new Date()
  if (range === "30d") {
    const from = addDays(now, -29)
    return eachDay(from, now).map((d, i) => ({
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      ventas: Math.round(800 + Math.sin(i/2)*200 + (i*15)),
    }))
  }
  if (range === "12m") {
    const from = addMonths(now, -11)
    const months = eachMonth(from, now)
    return months.map(({ y, m }, i) => ({
      label: new Date(y, m-1, 1).toLocaleDateString(undefined, { month: "short" }),
      ventas: Math.round(12000 + Math.cos(i/2)*2500 + i*300),
    }))
  }
  const years = eachYear(new Date(now.getFullYear()-4,0,1), now)
  return years.map((y, i) => ({
    label: String(y),
    ventas: Math.round(120000 + i*15000 + (i%2?8000:-6000)),
  }))
}
