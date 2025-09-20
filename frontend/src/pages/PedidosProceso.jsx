// src/pages/PedidosProceso.jsx
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { listOrdersCombined } from "@/api/orders"

/* shadcn UI */
import {
  Card, CardHeader, CardTitle, CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table"
import {
  Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious, PaginationLink,
} from "@/components/ui/pagination"

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

export default function PedidosProceso() {
  // Filtro libre (cliente/producto)
  const [q, setQ] = useState("")

  // Paginación
  const [page, setPage] = useState(0)
  const pageSize = 30

  // Data
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState("")

  const navigate = useNavigate()

  const load = async () => {
    setLoading(true); setMsg("")
    try {
      const data = await listOrdersCombined({
        q: q || undefined,
        state: "PENDIENTE,EN_PROCESO",
        limit: pageSize,
        offset: page * pageSize,
      })
      setRows(Array.isArray(data?.items) ? data.items : [])
      setTotal(Number(data?.total || 0))
    } catch (e) {
      console.error(e)
      setMsg("Error cargando pedidos")
      setRows([]); setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  // Cargar por página
  useEffect(() => { load() /* eslint-disable-line */ }, [page])

  // Debounce para búsqueda libre
  useEffect(() => {
    const t = setTimeout(() => { setPage(0); load() }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const canPrev = page > 0
  const canNext = (page + 1) * pageSize < total
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((total || 0) / pageSize)),
    [total]
  )

  return (
    <Card className="w-full">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Pedidos activos (pendientes + en proceso)</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filtro texto libre */}
        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-3">
            <Label>Texto libre (cliente/producto)</Label>
            <Input
              placeholder="Escribe para filtrar…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
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
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.fecha).toLocaleString()}</TableCell>
                  <TableCell>{r.customerName}</TableCell>
                  <TableCell><EstadoBadge state={r.state} /></TableCell>
                  <TableCell className="text-right">
                    <Button onClick={() => navigate(`/app/entregas/orden/${r.id}`)}>
                      Elegir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {loading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No hay pedidos
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
