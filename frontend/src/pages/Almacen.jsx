// frontend/src/pages/Almacen.jsx
import { useEffect, useMemo, useState } from "react"
import {
  fetchPrimaryStock,
  fetchFinishedSummary,
  fetchFinishedByProduct,
  fetchMerma,
  deleteMerma,
} from "@/api/stock"
import api from "@/api/axios"
import { getUserFromToken, hasRole } from "@/utils/auth"

/* Modales existentes (pueden estar implementados con Dialog por dentro) */
import AddPTModal from "@/components/AddPTModal"
import MoveMPModal from "@/components/MoveMPModal"
import AddMermaModal from "@/components/AddMermaModal"
import ExtrasModal from "@/components/ExtrasModal"
import RemoveMermaModal from "@/components/RemoveMermaModal"
import CreatePrimaryMaterialModal from "@/components/CreatePrimaryMaterialModal"
import CreateProductModal from "@/components/CreateProductModal"
import CompositionModal from "@/components/CompositionModal"

/* shadcn UI */
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell
} from "@/components/ui/table"
import {
  Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious, PaginationLink
} from "@/components/ui/pagination"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog"
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem
} from "@/components/ui/command"
import { ScrollArea } from "@/components/ui/scroll-area"

const fmtKg   = (v) => (Number.isFinite(Number(v)) ? Number(v).toFixed(2) : "0.00")
const fmtDate = (s) => (s ? new Date(s).toLocaleString() : "—")

/* ----- Dialog: elegir producto SIN composición (buscable) ----- */
function PickProductForCompDialog({ open, onOpenChange, onPicked }) {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [q, setQ] = useState("")
  const [msg, setMsg] = useState("")

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true); setMsg("")
    ;(async () => {
      try {
        const r = await api.get("/api/products/without-composition")
        if (!alive) return
        const rows = Array.isArray(r.data) ? r.data : []
        setItems(rows)
        if (rows.length === 0) setMsg("Todos los productos tienen composición.")
      } catch (e) {
        if (!alive) return
        setItems([])
        setMsg(e.response?.data?.error || "No se pudo obtener la lista")
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [open])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return items
    return items.filter(p =>
      String(p.name || p.DESCRIPCION || "").toLowerCase().includes(term)
    )
  }, [items, q])

  return (
    <Dialog open={open} onOpenChange={(v) => { setQ(""); onOpenChange?.(v) }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Elegir producto (sin composición)</DialogTitle>
        </DialogHeader>

        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar producto…"
            value={q}
            onValueChange={setQ}
          />
          <CommandList>
            {loading && <div className="p-3 text-sm text-muted-foreground">Cargando…</div>}
            {!loading && (
              <>
                <CommandEmpty>Sin resultados</CommandEmpty>
                {msg && <div className="px-3 py-2 text-sm text-muted-foreground">{msg}</div>}
                <CommandGroup heading="Productos">
                  <ScrollArea className="max-h-72">
                    {filtered.map((p) => {
                      const id = p.id || p.ID_PRODUCT
                      const name = p.name || p.DESCRIPCION || `Producto #${id}`
                      return (
                        <CommandItem
                          key={id}
                          onSelect={() => onPicked?.(id)}
                          className="cursor-pointer"
                        >
                          {name}
                        </CommandItem>
                      )
                    })}
                  </ScrollArea>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

/* ----- Página ----- */
export default function Almacen() {
  const me = getUserFromToken()
  const puedePT      = hasRole(me,"JEFE") || hasRole(me,"ADMINISTRADOR") || hasRole(me,"PRODUCCION")
  const puedeMoverMP = hasRole(me,"JEFE") || hasRole(me,"ADMINISTRADOR") || hasRole(me,"ALMACENERO") || hasRole(me,"PRODUCCION")
  const puedeMerma   = hasRole(me,"JEFE") || hasRole(me,"ADMINISTRADOR") || hasRole(me,"ALMACENERO") || hasRole(me,"PRODUCCION")

  const [tab, setTab] = useState("ALMACEN")
  const [q, setQ] = useState("")
  const [page, setPage] = useState(0)
  const pageSize = 30

  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState("")

  // PT expand
  const [expandedPT, setExpandedPT] = useState(null)
  const [ptDetailLoading, setPtDetailLoading] = useState(false)
  const [ptDetailRows, setPtDetailRows] = useState([])

  // dialogs (externos)
  const [openPT, setOpenPT] = useState(false)
  const [openMove, setOpenMove] = useState(false)
  const [openMerma, setOpenMerma] = useState(false)
  const [openExtras, setOpenExtras] = useState(false)
  const [openRemoveMerma, setOpenRemoveMerma] = useState(false)
  const [rowToRemove, setRowToRemove] = useState(null)
  const [openCreateMP, setOpenCreateMP] = useState(false)
  const [openCreatePT, setOpenCreatePT] = useState(false)

  // composición
  const [openComp, setOpenComp] = useState(false)
  const [productForComp, setProductForComp] = useState(null)
  const [openPickComp, setOpenPickComp] = useState(false)

  const PT_ALMACEN_ID = 18
  const defaultFromForMove = tab === "RECEPCION" ? "RECEPCION" : "PRODUCCION"

  const load = async () => {
    setLoading(true); setMsg("")
    try {
      if (tab === "ALMACEN") {
        const data = await fetchFinishedSummary({ q, limit: pageSize, offset: page * pageSize })
        setRows(Array.isArray(data?.items) ? data.items : [])
        setTotal(Number(data?.total || 0))
      } else if (tab === "MERMA") {
        const data = await fetchMerma({ q, limit: pageSize, offset: page * pageSize })
        setRows(Array.isArray(data?.items) ? data.items : [])
        setTotal(Number(data?.total || 0))
      } else {
        const data = await fetchPrimaryStock({ zone: tab, q, limit: pageSize, offset: page * pageSize })
        setRows(Array.isArray(data?.items) ? data.items : [])
        setTotal(Number(data?.total || 0))
      }
    } catch (e) {
      console.error(e)
      setMsg("Error cargando stock")
      setRows([]); setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  // reset por tab
  useEffect(() => { setPage(0); setExpandedPT(null); setPtDetailRows([]) }, [tab])

  // cargar por tab/página
  useEffect(() => { load() /* eslint-disable-line */ }, [tab, page])

  // Buscador reactivo (350ms)
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(0)
      setExpandedPT(null)
      setPtDetailRows([])
      load()
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const canPrev = page > 0
  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize))
  const canNext = page + 1 < totalPages

  const togglePTDetail = async (productId) => {
    if (expandedPT === productId) {
      setExpandedPT(null)
      setPtDetailRows([])
      return
    }
    setExpandedPT(productId)
    setPtDetailRows([])
    setPtDetailLoading(true)
    try {
      const det = await fetchFinishedByProduct(productId)
      setPtDetailRows(Array.isArray(det) ? det : [])
    } catch (e) {
      console.error(e)
      setPtDetailRows([])
    } finally {
      setPtDetailLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex items-center justify-between space-y-0">
        <CardTitle className="text-xl">Almacén</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Tabs + acciones */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="ALMACEN">Almacén (PT)</TabsTrigger>
                <TabsTrigger value="RECEPCION">Recepción (MP)</TabsTrigger>
                <TabsTrigger value="PRODUCCION">Producción (MP)</TabsTrigger>
                <TabsTrigger value="MERMA">Merma</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex-1" />

            {tab === "ALMACEN" && (
              <div className="flex gap-2">
                {puedePT && <Button onClick={() => setOpenPT(true)}>+ Producto Terminado</Button>}
                <Button variant="secondary" onClick={() => setOpenCreateMP(true)}>Crear MP</Button>
                <Button variant="secondary" onClick={() => setOpenCreatePT(true)}>Crear PT</Button>
                <Button
                  variant="secondary"
                  title="Definir composición para productos que aún no la tienen"
                  onClick={() => setOpenPickComp(true)}
                >
                  Composición
                </Button>
                <Button variant="secondary" onClick={() => setOpenExtras(true)}>Extras</Button>
              </div>
            )}

            {(tab === "RECEPCION" || tab === "PRODUCCION") && puedeMoverMP && (
              <Button variant="secondary" onClick={() => setOpenMove(true)}>Mover MP</Button>
            )}

            {tab === "MERMA" && puedeMerma && (
              <Button variant="secondary" onClick={() => setOpenMerma(true)}>+ Merma</Button>
            )}
          </div>

          {/* Buscador */}
          <Input
            placeholder="Buscar…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {msg && <div className="text-sm text-muted-foreground">{msg}</div>}

        {/* === Contenido por tab === */}
        <Tabs value={tab}>
          {/* ---- ALMACÉN (PT) ---- */}
          <TabsContent value="ALMACEN" className="space-y-3">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Total (kg)</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!loading && rows.map((r, i) => {
                    const pid = r.productId
                    const open = expandedPT === pid
                    return (
                      <FragmentRow
                        key={`${pid}-${i}`}
                        main={
                          <>
                            <TableCell>{r.productName}</TableCell>
                            <TableCell>{fmtKg(r.stockKg)}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="secondary" size="sm" onClick={() => togglePTDetail(pid)}>
                                {open ? "Ocultar" : "Ver"}
                              </Button>
                            </TableCell>
                          </>
                        }
                        expanded={open}
                        colSpan={3}
                      >
                        {ptDetailLoading ? (
                          <div className="text-sm text-muted-foreground">Cargando presentaciones…</div>
                        ) : (
                          <div className="rounded-md border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Presentación</TableHead>
                                  <TableHead>Stock (kg)</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {ptDetailRows.map((p, idx) => (
                                  <TableRow key={`${pid}-${(p.presentacion ?? "NULL")}-${idx}`}>
                                    <TableCell>{p.presentacion ?? "—"} Kg</TableCell>
                                    <TableCell>{fmtKg(p.stockKg)} Kg</TableCell>
                                  </TableRow>
                                ))}
                                {ptDetailRows.length === 0 && (
                                  <TableRow>
                                    <TableCell colSpan={2} className="text-muted-foreground">
                                      Sin presentaciones con stock
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </FragmentRow>
                    )
                  })}
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">Cargando…</TableCell>
                    </TableRow>
                  )}
                  {!loading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">Sin resultados</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ---- MP (RECEPCION / PRODUCCION) ---- */}
          <TabsContent value="RECEPCION" className="space-y-3">
            <MPTable loading={loading} rows={rows} />
          </TabsContent>
          <TabsContent value="PRODUCCION" className="space-y-3">
            <MPTable loading={loading} rows={rows} />
          </TabsContent>

          {/* ---- MERMA ---- */}
          <TabsContent value="MERMA" className="space-y-3">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Ítem</TableHead>
                    <TableHead>Merma (kg)</TableHead>
                    <TableHead>Última act.</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!loading && rows.map((r, i) => (
                    <TableRow key={`${r.id || r.rowId || i}`}>
                      <TableCell>{r.type || r.TIPO || "—"}</TableCell>
                      <TableCell>{r.name || r.itemName || r.DESCRIPCION || "—"}</TableCell>
                      <TableCell>{fmtKg(r.stockKg || r.peso || r.MERMA)}</TableCell>
                      <TableCell>{fmtDate(r.lastUpdate)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => { setRowToRemove(r); setOpenRemoveMerma(true) }}
                        >
                          Eliminar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">Cargando…</TableCell>
                    </TableRow>
                  )}
                  {!loading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">Sin resultados</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        {/* Paginación */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">Página {page + 1} de {totalPages}</div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious onClick={() => canPrev && setPage((p) => p - 1)} aria-disabled={!canPrev}/>
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
                <PaginationNext onClick={() => canNext && setPage((p) => p + 1)} aria-disabled={!canNext}/>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </CardContent>

      {/* ==== Dialogs ==== */}
      <AddPTModal
        open={openPT}
        onClose={() => setOpenPT(false)}
        defaultZoneId={PT_ALMACEN_ID}
        onDone={() => { setExpandedPT(null); setPtDetailRows([]); load() }}
      />
      <MoveMPModal
        open={openMove}
        onClose={() => setOpenMove(false)}
        onDone={load}
        defaultFrom={defaultFromForMove}
      />
      <AddMermaModal open={openMerma} onClose={() => setOpenMerma(false)} onDone={load} />
      <ExtrasModal open={openExtras} onClose={() => setOpenExtras(false)} />
      <RemoveMermaModal
        open={openRemoveMerma}
        onClose={() => { setOpenRemoveMerma(false); setRowToRemove(null) }}
        row={rowToRemove}
        onDone={load}
      />
      <CreatePrimaryMaterialModal
        open={openCreateMP}
        onClose={() => setOpenCreateMP(false)}
        onDone={() => { if (tab !== "ALMACEN") load() }}
      />
      <CreateProductModal
        open={openCreatePT}
        onClose={() => setOpenCreatePT(false)}
        onDone={() => { /* opcional */ }}
      />

      {/* Elegir producto (sin composición) con buscador */}
      <PickProductForCompDialog
        open={openPickComp}
        onOpenChange={setOpenPickComp}
        onPicked={(pid) => {
          setOpenPickComp(false)
          setProductForComp(pid)
          setOpenComp(true)
        }}
      />

      {/* Editor de Composición */}
      <CompositionModal
        open={openComp}
        onClose={() => setOpenComp(false)}
        productId={productForComp}
        onDone={() => { /* ok */ }}
      />
    </Card>
  )
}

/* ---- Subtable MP (Recepción / Producción) ---- */
function MPTable({ loading, rows }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Materia prima</TableHead>
            <TableHead>Color / Denier</TableHead>
            <TableHead>Stock (kg)</TableHead>
            <TableHead>Última act.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!loading && rows.map((r, i) => (
            <TableRow key={`${r.primaterId || r.id || i}`}>
              <TableCell>{[r.material, r.descripcion].filter(Boolean).join(" · ")}</TableCell>
              <TableCell>{(r.color || "—") + " / " + (r.denier != null ? r.denier : "Sin denier")}</TableCell>
              <TableCell>{fmtKg(r.stockKg)}</TableCell>
              <TableCell>{fmtDate(r.lastUpdate)}</TableCell>
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
  )
}

/* ---- Row con sección expandible (para PT) ---- */
function FragmentRow({ main, expanded, colSpan, children }) {
  return (
    <>
      <TableRow>{main}</TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={colSpan}>
            {children}
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
