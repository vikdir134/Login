import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { listDeliveries } from "@/api/deliveries"
import { hasRole, getUserFromToken } from "@/utils/auth"

/* shadcn UI */
import {
  Card, CardHeader, CardTitle, CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table"
import {
  Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious, PaginationLink,
} from "@/components/ui/pagination"
import { Badge } from "@/components/ui/badge"

const fmtKg = (n) => (Number(n) || 0).toFixed(2)

/* Badge de estado consistente con otras pantallas */
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

export default function Entregas() {
  const me = getUserFromToken()
  const puedeCrear =
    hasRole(me, "PRODUCCION") || hasRole(me, "JEFE") || hasRole(me, "ADMINISTRADOR")

  // filtros
  const [q, setQ] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  // tabla/paginado
  const [page, setPage] = useState(0)
  const pageSize = 30
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState("")

  const navigate = useNavigate()

  const load = async ({ signal } = {}) => {
    setLoading(true); setMsg("")
    try {
      const data = await listDeliveries({
        q: q || undefined,
        from: from || undefined,
        to: to || undefined,
        limit: pageSize,
        offset: page * pageSize,
      })
      if (signal?.aborted) return
      setRows(Array.isArray(data?.items) ? data.items : [])
      setTotal(Number(data?.total || 0))
    } catch (e) {
      if (signal?.aborted) return
      console.error(e)
      setMsg("Error cargando entregas")
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  // búsqueda reactiva con debounce en q/from/to
  useEffect(() => {
    const controller = new AbortController()
    const t = setTimeout(() => {
      setPage(0)
      load({ signal: controller.signal })
    }, 350)
    return () => { controller.abort(); clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, from, to])

  // recarga al cambiar de página
  useEffect(() => {
    const controller = new AbortController()
    load({ signal: controller.signal })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const canPrev = page > 0
  const canNext = (page + 1) * pageSize < total
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((total || 0) / pageSize)),
    [total]
  )

  return (
    <Card className="w-full">
      <CardHeader className="flex items-center justify-between space-y-0">
        <CardTitle className="text-xl">Entregas</CardTitle>
        {puedeCrear && (
          <Button onClick={() => navigate("/app/entregas/nueva")}>
            + Nueva entrega
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label>Buscar</Label>
            <Input
              placeholder="Cliente / estado / producto…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="md:col-span-1">
            <Label>Desde</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>

          <div className="md:col-span-1">
            <Label>Hasta</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        {msg && <div className="text-sm text-muted-foreground">{msg}</div>}

        {/* Tabla */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado pedido</TableHead>
                <TableHead>Peso total</TableHead>
                <TableHead>Subtotal</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && rows.map((r, i) => (
                <TableRow key={r.deliveryId || i}>
                  <TableCell>{new Date(r.fecha).toLocaleString()}</TableCell>
                  <TableCell>{r.customerName}</TableCell>
                  <TableCell><EstadoBadge state={r.orderState} /></TableCell>
                  <TableCell>{fmtKg(r.pesoTotal)} kg</TableCell>
                  <TableCell>{(Number(r.subtotalTotal) || 0).toFixed(2)} {r.currency || ""}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="secondary" size="sm" asChild>
                      <Link to={`/app/entregas/orden/${r.orderId}`}>Ver pedido</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    Sin resultados
                  </TableCell>
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
                <PaginationPrevious
                  onClick={() => canPrev && setPage((p) => Math.max(0, p - 1))}
                  aria-disabled={!canPrev}
                />
              </PaginationItem>

              {Array.from({ length: totalPages })
                .slice(Math.max(0, page - 1), Math.min(totalPages, page + 2))
                .map((_, idx) => {
                  const p = Math.max(0, page - 1) + idx
                  return (
                    <PaginationItem key={p}>
                      <PaginationLink isActive={p === page} onClick={() => setPage(p)}>
                        {p + 1}
                      </PaginationLink>
                    </PaginationItem>
                  )
                })}

              <PaginationItem>
                <PaginationNext
                  onClick={() => canNext && setPage((p) => p + 1)}
                  aria-disabled={!canNext}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </CardContent>
    </Card>
  )
}
