import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Plus, Search } from "lucide-react"

import { fetchCustomers } from "../api/customers"
import { hasRole, getUserFromToken } from "../utils/auth"
import AddCustomerModal from "../components/AddCustomerModal"

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationLink,
} from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"

export default function Clientes() {
  const me = getUserFromToken()
  const puedeCrear = hasRole(me, "JEFE") || hasRole(me, "ADMINISTRADOR")

  const [q, setQ] = useState("")
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [openNew, setOpenNew] = useState(false)

  // Paginación
  const [page, setPage] = useState(0)
  const pageSize = 30

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((total || 0) / pageSize)),
    [total]
  )
  const canPrev = page > 0
  const canNext = page + 1 < totalPages

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchCustomers({
        q,
        limit: pageSize,
        offset: page * pageSize,
      })

      if (Array.isArray(data)) {
        setRows(data)
        // Fallback de total si el API no lo envía
        const fallback =
          data.length < pageSize && page === 0
            ? data.length
            : (page + 1) * pageSize + (data.length === pageSize ? pageSize : 0)
        setTotal(fallback)
      } else {
        setRows(Array.isArray(data?.items) ? data.items : [])
        setTotal(Number(data?.total || 0))
      }
    } catch (e) {
      setRows([])
      setTotal(0)
      toast.error("Error cargando clientes", {
        description: "Revisa tu conexión o intenta nuevamente.",
      })
    } finally {
      setLoading(false)
    }
  }

  // Buscar y paginar
  useEffect(() => {
    setPage(0)
  }, [q])
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, page])

  // Estado con colores (verde/rojo)
  const EstadoBadge = ({ activo }) => (
    <Badge
      variant="outline"
      className={
        activo
          ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-600/30"
          : "bg-red-500/10 text-red-700 dark:text-red-400 border-red-600/30"
      }
    >
      {activo ? "Activo" : "Inactivo"}
    </Badge>
  )

  const handlePrev = () => canPrev && setPage((p) => Math.max(0, p - 1))
  const handleNext = () => canNext && setPage((p) => p + 1)

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xl">Clientes</CardTitle>
        {puedeCrear && (
          <Button onClick={() => setOpenNew(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Buscador */}
        <div className="relative list-none">
          <Search className="pointer-events-none inline-block absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60 text-muted-foreground" />
          <Input
            type="text"
            className="!pl-9 appearance-none"
            placeholder="Buscar por RUC o Razón social…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Buscar clientes"
          />
        </div>


        {/* Tabla */}
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">Sin resultados</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>RUC</TableHead>
                <TableHead>Razón social</TableHead>
                <TableHead className="w-[120px]">Estado</TableHead>
                <TableHead className="text-right w-[120px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.RUC}</TableCell>
                  <TableCell className="font-medium">{r.razonSocial}</TableCell>
                  <TableCell>
                    <EstadoBadge activo={!!r.activo} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="secondary" size="sm" asChild>
                      <Link to={`/app/clientes/${r.id}`}>Ver</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Paginación */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages}
          </div>

          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious onClick={handlePrev} aria-disabled={!canPrev} />
              </PaginationItem>

              {Array.from({ length: totalPages })
                .slice(Math.max(0, page - 1), Math.min(totalPages, page + 2))
                .map((_, idx) => {
                  const p = Math.max(0, page - 1) + idx
                  return (
                    <PaginationItem key={p}>
                      <PaginationLink
                        isActive={p === page}
                        onClick={() => setPage(p)}
                      >
                        {p + 1}
                      </PaginationLink>
                    </PaginationItem>
                  )
                })}

              <PaginationItem>
                <PaginationNext onClick={handleNext} aria-disabled={!canNext} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </CardContent>

      {/* Dialog/Sheet lo migramos después; por ahora tu modal existente */}
      <AddCustomerModal open={openNew} onClose={() => setOpenNew(false)} onSuccess={load} />
    </Card>
  )
}
