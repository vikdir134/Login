import { useEffect, useMemo, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { fetchOrder } from '@/api/orders'
import {
  addOrderLine,
  updateOrderLine,
  deleteOrderLine,
  cancelOrder,
  reactivateOrder,
} from '@/api/orders'
import { fetchDeliveriesByOrder } from '@/api/deliveries'
import { hasRole, getUserFromToken } from '@/utils/auth'
import api from '@/api/axios'

/* shadcn */
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/* Dialog para agregar línea (tu componente) */
import AddOrderLineDialog from '@/components/AddOrderLineDialog'

/** === Config === */
const IGV = 0.18

/** === Utils UI === */
const EstadoBadge = ({ state }) => {
  const s = String(state || '').toUpperCase()
  if (s === 'ENTREGADO')
    return (
      <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-600/30" variant="outline">
        ENTREGADO
      </Badge>
    )
  if (s === 'EN_PROCESO')
    return (
      <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-600/30" variant="outline">
        EN PROCESO
      </Badge>
    )
  if (s === 'PENDIENTE')
    return (
      <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-600/30" variant="outline">
        PENDIENTE
      </Badge>
    )
  if (s === 'CANCELADO') return <Badge variant="secondary">CANCELADO</Badge>
  return <Badge variant="outline">{s || '—'}</Badge>
}

const fmtKg = (n) => (Number(n) || 0).toFixed(2)
const fmtMoney = (n) => (Number(n) || 0).toFixed(2)

/** === helpers búsqueda === */
const normalize = (s = '') => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
function filterStartsThenIncludes(options, query, getLabel) {
  const q = normalize(query)
  if (!q) return []
  const starts = []
  const includes = []
  for (const opt of options) {
    const l = normalize(getLabel(opt))
    if (l.startsWith(q)) starts.push(opt)
    else if (l.includes(q)) includes.push(opt)
  }
  return [...starts, ...includes]
}

/** === Autocomplete ligero (sin libs) === */
function Autocomplete({
  label,
  value,
  display,
  onChange,
  options,
  getLabel,
  getKey,
  placeholder = 'Escribe para buscar…',
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(display || '')
  const [hoverIdx, setHoverIdx] = useState(-1)
  const boxRef = useRef(null)

  useEffect(() => {
    const onDoc = (e) => {
      if (!boxRef.current) return
      if (!boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const results = useMemo(() => {
    if (!query) return []
    return filterStartsThenIncludes(options, query, getLabel).slice(0, 20)
  }, [options, query, getLabel])

  useEffect(() => {
    setQuery(display || '')
  }, [display])

  const choose = (opt) => {
    const id = getKey(opt)
    const text = getLabel(opt)
    onChange(id, opt)
    setQuery(text)
    setOpen(false)
  }

  const onKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true)
      return
    }
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHoverIdx((i) => Math.min(results.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHoverIdx((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = results[hoverIdx] ?? results[0]
      if (opt) choose(opt)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <label className="form-field" ref={boxRef} style={{ position: 'relative' }}>
      {label && <span>{label}</span>}
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <Card
          className="mt-1"
          style={{ position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 20, maxHeight: 280, overflow: 'auto' }}
        >
          <CardContent className="p-1.5">
            {results.map((opt, idx) => (
              <div
                key={getKey(opt)}
                onMouseEnter={() => setHoverIdx(idx)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(opt)}
                className={`rounded-md px-2 py-2 cursor-pointer ${idx === hoverIdx ? 'bg-accent' : 'bg-transparent'}`}
              >
                {getLabel(opt)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </label>
  )
}

export default function PedidoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const me = getUserFromToken()
  const puedeEntregar = hasRole(me, 'PRODUCCION') || hasRole(me, 'JEFE') || hasRole(me, 'ADMINISTRADOR')
  const puedeEditar = hasRole(me, 'PRODUCCION') || hasRole(me, 'JEFE') || hasRole(me, 'ADMINISTRADOR')
  const puedeEstado = hasRole(me, 'JEFE') || hasRole(me, 'ADMINISTRADOR')

  const [order, setOrder] = useState(null)
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)

  // cat. productos para agregar línea
  const [products, setProducts] = useState([])

  // UI: edición en línea
  const [editLineId, setEditLineId] = useState(null)
  const [editForm, setEditForm] = useState({ peso: '', presentacion: '' })

  // Dialogs
  const [openCancel, setOpenCancel] = useState(false)
  const [openAdd, setOpenAdd] = useState(false)

  // Dialog eliminar línea
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, lineId: null, lineName: '' })

  const load = async () => {
    setLoading(true)
    try {
      const [o, d, p] = await Promise.all([
        fetchOrder(id),
        fetchDeliveriesByOrder(id),
        api.get('/api/catalog/products?limit=1000').then((r) => r.data).catch(() => []),
      ])
      setOrder(o)
      setDeliveries(Array.isArray(d) ? d : [])
      setProducts(Array.isArray(p) ? p : [])
    } catch (e) {
      console.error(e)
      toast.error('Error cargando pedido')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load()   }, [id])

  // entregado por línea
  const entregadoPorLinea = useMemo(() => {
    const map = new Map()
    for (const l of deliveries) {
      const k = Number(l.descriptionOrderId)
      map.set(k, Number(map.get(k) || 0) + Number(l.peso || 0))
    }
    return map
  }, [deliveries])

  const lines = useMemo(() => {
    if (!order?.lines) return []
    return order.lines.map((l) => {
      const entregado = Number(entregadoPorLinea.get(Number(l.id)) || 0)
      const pedido = Number(l.peso || l.pesoPedido || 0)
      const pendiente = Math.max(0, pedido - entregado)
      return { ...l, pedido, entregado, pendiente }
    })
  }, [order, entregadoPorLinea])

  const totals = useMemo(() => {
    const pedido = lines.reduce((a, l) => a + l.pedido, 0)
    const entregado = lines.reduce((a, l) => a + l.entregado, 0)
    const avance = pedido ? Math.min(100, (entregado / pedido) * 100) : 0
    return { pedido, entregado, avance }
  }, [lines])

  // ====== acciones líneas ======
  const startEdit = (l) => {
    setEditLineId(l.id)
    setEditForm({ peso: l.pedido, presentacion: l.presentacion })
  }
  const cancelEdit = () => {
    setEditLineId(null)
    setEditForm({ peso: '', presentacion: '' })
  }
  const submitEdit = async (lineId) => {
    try {
      await updateOrderLine(Number(id), Number(lineId), {
        peso: Number(editForm.peso),
        presentacion: Number(editForm.presentacion),
      })
      cancelEdit()
      await load()
      toast.success('Línea actualizada')
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.error || 'Error actualizando línea')
    }
  }
  const askRemoveLine = (l) => {
    setDeleteConfirm({ open: true, lineId: l.id, lineName: l.productName || `Línea #${l.id}` })
  }
  const confirmRemove = async () => {
    const lineId = deleteConfirm.lineId
    try {
      await deleteOrderLine(Number(id), Number(lineId))
      setDeleteConfirm({ open: false, lineId: null, lineName: '' })
      await load()
      toast.success('Línea eliminada')
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.error || 'No se pudo eliminar la línea')
    }
  }

  // ====== estado ======
  const onCancelConfirmed = async () => {
    try {
      await cancelOrder(Number(id))
      setOpenCancel(false)
      await load()
      toast.success('Pedido cancelado')
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.error || 'Error cancelando pedido')
    }
  }
  const onReactivate = async () => {
    try {
      await reactivateOrder(Number(id))
      await load()
      toast.success('Pedido reactivado')
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.error || 'Error reactivando pedido')
    }
  }
  const onRefreshState = async () => {
    try {
      if (String(order.state).toUpperCase() === 'CANCELADO') {
        await reactivateOrder(Number(id))
      } else {
        await cancelOrder(Number(id))
        await reactivateOrder(Number(id))
      }
      await load()
      toast.success('Estado recalculado según entregas y líneas')
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.error || 'No se pudo recacular el estado')
    }
  }

  // ====== agrupación de entregas ======
  const grouped = useMemo(() => {
    const map = new Map()
    for (const d of deliveries) {
      const k = String(d.deliveryId)
      if (!map.has(k)) {
        map.set(k, {
          deliveryId: d.deliveryId,
          fecha: d.fecha,
          facturaId: d.facturaId ?? null,
          invoiceCode: d.invoiceCode ?? null,
          currency: d.currency || 'PEN',
          lines: [],
        })
      }
      map.get(k).lines.push({
        lineId: d.lineId,
        descriptionOrderId: d.descriptionOrderId,
        peso: Number(d.peso || 0),
        unitPrice: d.unitPrice != null ? Number(d.unitPrice) : null,
        subtotal: Number(d.subtotal || 0),
        currency: d.currency || 'PEN',
        descripcion: d.descripcion || null,
      })
    }
    const arr = Array.from(map.values())
    for (const g of arr) {
      g.pesoTotal = g.lines.reduce((a, l) => a + (Number(l.peso) || 0), 0)
      g.subtotalTotal = g.lines.reduce((a, l) => a + (Number(l.subtotal) || 0), 0)
      g.totalConIGV = +(g.subtotalTotal * (1 + IGV)).toFixed(2)
    }
    arr.sort((a, b) => {
      const ta = new Date(a.fecha).getTime()
      const tb = new Date(b.fecha).getTime()
      if (tb !== ta) return tb - ta
      return Number(b.deliveryId) - Number(a.deliveryId)
    })
    return arr
  }, [deliveries])

  if (loading) return <Card className="w-full"><CardContent className="p-6">Cargando…</CardContent></Card>
  if (!order)   return <Card className="w-full"><CardContent className="p-6">Pedido no encontrado</CardContent></Card>

  const isCancelado = String(order.state).toUpperCase() === 'CANCELADO'
  const productLabel = (p) => p.name || p.DESCRIPCION || `Producto #${p.id}`

  return (
    <Card className="w-full">
      <CardContent className="p-4 md:p-6 space-y-4">
        {/* Encabezado */}
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-semibold">Pedido #{order.id}</h3>
          <EstadoBadge state={order.state} />
          <div className="flex-1" />
          {puedeEstado && (
            <div className="flex gap-2 flex-wrap">
              <Button variant="secondary" onClick={onRefreshState}>Actualizar estado</Button>
              {!isCancelado ? (
                <Button variant="secondary" onClick={() => setOpenCancel(true)}>Cancelar pedido</Button>
              ) : (
                <Button onClick={onReactivate}>Reactivar</Button>
              )}
            </div>
          )}
        </div>

        <div className="text-sm text-muted-foreground">
          {order.customerName} · {new Date(order.fecha).toLocaleString()}
        </div>

        {/* Avance (shadcn Progress) */}
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">Avance de entrega</div>
          <Progress value={order.avanceEntrega ?? totals.avance} />
          <div className="text-sm text-muted-foreground">
            Entregado: {fmtKg(totals.entregado)} / {fmtKg(totals.pedido)} kg
          </div>
        </div>

        {/* Líneas + botón agregar */}
        <div className="flex items-center gap-2">
          <h4 className="text-base font-semibold m-0">Líneas del pedido</h4>
          <div className="flex-1" />
          {puedeEditar && !isCancelado && <Button onClick={() => setOpenAdd(true)}>+ Agregar línea</Button>}
        </div>

        {/* Tabla de líneas (shadcn Table) */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="w-32">Presentación</TableHead>
                <TableHead className="w-32">Pedido</TableHead>
                <TableHead className="w-32">Entregado</TableHead>
                <TableHead className="w-32">Pendiente</TableHead>
                <TableHead className="text-right w-56">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.productName}</TableCell>

                  {editLineId === l.id ? (
                    <>
                      <TableCell>
                        <Input
                          type="number"
                          step="1"
                          min="1"
                          value={editForm.presentacion}
                          onChange={(e) => setEditForm((f) => ({ ...f, presentacion: e.target.value }))}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min={l.entregado}
                          value={editForm.peso}
                          onChange={(e) => setEditForm((f) => ({ ...f, peso: e.target.value }))}
                        />
                      </TableCell>
                      <TableCell>{fmtKg(l.entregado)} kg</TableCell>
                      <TableCell>{fmtKg(Math.max(0, Number(editForm.peso || 0) - l.entregado))} kg</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button onClick={() => submitEdit(l.id)}>Guardar</Button>
                          <Button variant="secondary" onClick={cancelEdit}>Cancelar</Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>{Number(l.presentacion || 0).toFixed(0)}</TableCell>
                      <TableCell>{fmtKg(l.pedido)} kg</TableCell>
                      <TableCell>{fmtKg(l.entregado)} kg</TableCell>
                      <TableCell>{fmtKg(l.pendiente)} kg</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          {puedeEditar && !isCancelado && (
                            <>
                              <Button variant="secondary" onClick={() => startEdit(l)}>Editar</Button>
                              <Button variant="secondary" disabled={l.entregado > 0} onClick={() => askRemoveLine(l)}>
                                Eliminar
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
              {lines.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">Sin líneas</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Entregas (shadcn Table) */}
        <div className="flex items-center gap-2">
          <h4 className="text-base font-semibold m-0">Entregas realizadas</h4>
          <div className="flex-1" />
          {puedeEntregar && !isCancelado && (
            <Button onClick={() => navigate(`/app/entregas/orden/${id}`)}>+ Nueva entrega</Button>
          )}
        </div>

        {grouped.length === 0 && <div className="text-sm text-muted-foreground">Sin entregas</div>}

        {grouped.map((g) => (
          <Card key={g.deliveryId} className="mt-2">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="font-semibold">
                  Entrega #{g.deliveryId} · {new Date(g.fecha).toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">
                  Factura: {g.invoiceCode ? <b>{g.invoiceCode}</b> : 'Sin factura'}
                </div>
                <div className="flex-1" />
                <div className="text-sm text-muted-foreground">
                  Subtotal: {fmtMoney(g.subtotalTotal)} {g.currency} ·{' '}
                  <b>Total (c/IGV): {fmtMoney(g.totalConIGV)} {g.currency}</b>
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Peso</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Subtotal</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Comentario</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.lines.map((l, idx) => {
                      const totalLinea = Number(l.subtotal || 0) * (1 + IGV)
                      return (
                        <TableRow key={`${g.deliveryId}-${l.lineId}-${idx}`}>
                          <TableCell>{fmtKg(l.peso)} kg</TableCell>
                          <TableCell>{l.unitPrice != null ? fmtMoney(l.unitPrice) : '0.00'} {l.currency}</TableCell>
                          <TableCell>{fmtMoney(l.subtotal)} {l.currency}</TableCell>
                          <TableCell>{fmtMoney(totalLinea)} {l.currency}</TableCell>
                          <TableCell>{l.descripcion || <span className="text-muted-foreground">—</span>}</TableCell>
                        </TableRow>
                      )
                    })}
                    {g.lines.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground">Sin líneas</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))}
      </CardContent>

      {/* AlertDialog: Confirmar cancelar pedido */}
      <AlertDialog open={openCancel} onOpenChange={setOpenCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar pedido</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que deseas cancelar este pedido? Podrás reactivarlo luego.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={onCancelConfirmed}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog: Confirmar eliminar línea */}
      <AlertDialog
        open={deleteConfirm.open}
        onOpenChange={(o) => setDeleteConfirm((s) => ({ ...s, open: o }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar línea</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar la línea <b>{deleteConfirm.lineName}</b>. Esta acción no se puede deshacer.
              ¿Deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Agregar línea */}
      <AddOrderLineDialog
        open={openAdd}
        onOpenChange={setOpenAdd}
        products={products}
        onSubmit={async ({ productId, peso, presentacion }) => {
          try {
            await addOrderLine(Number(id), {
              productId: Number(productId),
              peso: Number(peso),
              presentacion: Number(presentacion),
            })
            await load()
            toast.success('Línea agregada')
            return true
          } catch (err) {
            console.error(err)
            toast.error(err.response?.data?.error || 'Error agregando línea')
            return false
          }
        }}
      />
    </Card>
  )
}
