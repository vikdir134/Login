// src/pages/EntregaDetalle.jsx
import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchOrder } from '@/api/orders'
import { fetchDeliveriesByOrder } from '@/api/deliveries'
import { hasRole, getUserFromToken } from '@/utils/auth'
import CreateDeliveryModal from '@/components/CreateDeliveryModal'

/* shadcn UI */
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell
} from '@/components/ui/table'

const IGV = 0.18
const fmtKg = n => (Number(n)||0).toFixed(2)
const fmtMoney = n => (Number(n)||0).toFixed(2)

export default function EntregaDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const me = getUserFromToken()
  const puedeEntregar =
    hasRole(me, 'PRODUCCION') || hasRole(me, 'JEFE') || hasRole(me, 'ADMINISTRADOR') || hasRole(me, 'ALMACENERO')

  const [order, setOrder] = useState(null)
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [openCreate, setOpenCreate] = useState(false)

  const load = async () => {
    setLoading(true); setMsg('')
    try {
      const [o, d] = await Promise.all([fetchOrder(id), fetchDeliveriesByOrder(id)])
      setOrder(o); setDeliveries(Array.isArray(d) ? d : [])
    } catch (e) {
      console.error(e); setMsg('Error cargando pedido')
    } finally { setLoading(false) }
  }
  useEffect(()=>{ load() }, [id])

  // entregado por línea (para pendientes)
  const entregadoPorLinea = useMemo(() => {
    const map = new Map()
    for (const l of deliveries) {
      const k = Number(l.descriptionOrderId)
      const suma = Number(map.get(k) || 0) + Number(l.peso || 0)
      map.set(k, suma)
    }
    return map
  }, [deliveries])

  const lines = useMemo(() => {
    if (!order?.lines) return []
    return order.lines.map(l => {
      const entregado = Number(entregadoPorLinea.get(Number(l.id)) || 0)
      const pedido = Number(l.peso || l.pesoPedido || 0)
      const pendiente = Math.max(0, pedido - entregado)
      return { ...l, pedido, entregado, pendiente }
    })
  }, [order, entregadoPorLinea])

  const pedidoPesoTotal = useMemo(() => lines.reduce((a, l) => a + l.pedido, 0), [lines])
  const entregadoTotal  = useMemo(() => lines.reduce((a, l) => a + l.entregado, 0), [lines])
  const avanceCalc = pedidoPesoTotal ? Math.min(100, (entregadoTotal / pedidoPesoTotal) * 100) : 0

  // AGRUPAR entregas por deliveryId + totales + archivos (factura/guía/nota crédito)
  const deliveriesGrouped = useMemo(() => {
    const map = new Map()
    for (const r of deliveries) {
      const k = r.deliveryId
      if (!map.has(k)) {
        map.set(k, {
          deliveryId: k,
          fecha: r.fecha,
          facturaId: r.facturaId,
          invoiceCode: r.invoiceCode,            // string opcional
          invoiceUrl: r.invoiceUrl,              // string opcional (/uploads/...)
          guiaCode: r.guiaCode,                  // string opcional
          guiaUrl: r.guiaUrl,                    // string opcional
          creditNoteCode: r.creditNoteCode,      // string opcional
          creditNoteUrl: r.creditNoteUrl,        // string opcional
          currency: r.currency || 'PEN',
          lines: []
        })
      }
      const g = map.get(k)
      // Mantener primeros valores no vacíos por si vienen repetidos por línea
      g.invoiceCode = g.invoiceCode || r.invoiceCode
      g.invoiceUrl  = g.invoiceUrl  || r.invoiceUrl
      g.guiaCode    = g.guiaCode    || r.guiaCode
      g.guiaUrl     = g.guiaUrl     || r.guiaUrl
      g.creditNoteCode = g.creditNoteCode || r.creditNoteCode
      g.creditNoteUrl  = g.creditNoteUrl  || r.creditNoteUrl
      g.lines.push(r)
    }
    const arr = Array.from(map.values()).map(g => {
      const subtotal = g.lines.reduce((a,r)=> a + Number(r.subtotal||0), 0)
      const totalConIGV = +(subtotal * (1 + IGV)).toFixed(2)
      return { ...g, subtotal, totalConIGV }
    })
    return arr.sort((a,b)=> new Date(b.fecha) - new Date(a.fecha))
  }, [deliveries])

  const EstadoBadge = ({ state }) => {
    const s = String(state || '').toUpperCase()
    if (s === 'ENTREGADO')
      return <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-600/30" variant="outline">ENTREGADO</Badge>
    if (s === 'EN_PROCESO')
      return <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-600/30" variant="outline">EN PROCESO</Badge>
    if (s === 'PENDIENTE')
      return <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-600/30" variant="outline">PENDIENTE</Badge>
    if (s === 'CANCELADO') return <Badge variant="secondary">CANCELADO</Badge>
    return <Badge variant="outline">{s || '—'}</Badge>
  }

  if (loading) return (
    <Card className="w-full">
      <CardContent className="p-6">Cargando…</CardContent>
    </Card>
  )
  if (!order)  return (
    <Card className="w-full">
      <CardContent className="p-6">Pedido no encontrado</CardContent>
    </Card>
  )

  return (
    <Card className="w-full">
      <CardContent className="p-4 md:p-6 space-y-4">
        {/* Topbar */}
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-semibold m-0">Pedido #{order.id}</h3>
          <EstadoBadge state={order.state} />
          <div className="flex-1" />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={()=> navigate('/app/entregas/nueva')}>← Volver</Button>
            {puedeEntregar && order.state !== 'CANCELADO' && (
              <Button onClick={()=>setOpenCreate(true)}>Nueva entrega</Button>
            )}
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          {order.customerName} · {new Date(order.fecha).toLocaleString()}
        </div>

        {/* Avance */}
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">Avance de entrega</div>
          <Progress value={order.avanceEntrega ?? avanceCalc} />
          <div className="text-sm text-muted-foreground">
            Entregado: {fmtKg(entregadoTotal)} / {fmtKg(pedidoPesoTotal)} kg
          </div>
        </div>

        {/* Líneas */}
        <div className="space-y-2">
          <h4 className="text-base font-semibold m-0">Líneas del pedido</h4>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="w-28">Presentación</TableHead>
                  <TableHead className="w-28">Pedido</TableHead>
                  <TableHead className="w-28">Entregado</TableHead>
                  <TableHead className="w-28">Pendiente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map(l => (
                  <TableRow key={l.id}>
                    <TableCell>{l.productName}</TableCell>
                    <TableCell>{l.presentacion ?? '—'}</TableCell>
                    <TableCell>{fmtKg(l.pedido)} kg</TableCell>
                    <TableCell>{fmtKg(l.entregado)} kg</TableCell>
                    <TableCell>{fmtKg(l.pendiente)} kg</TableCell>
                  </TableRow>
                ))}
                {lines.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">Sin líneas</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Entregas realizadas */}
        <div className="space-y-2">
          <h4 className="text-base font-semibold m-0">Entregas realizadas</h4>
          {deliveriesGrouped.length === 0 && (
            <div className="text-sm text-muted-foreground">Sin entregas</div>
          )}

          {deliveriesGrouped.map(grp => (
            <Card key={grp.deliveryId}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="font-semibold">
                    Entrega #{grp.deliveryId} · {new Date(grp.fecha).toLocaleString()}
                  </div>

                  {/* Documentos */}
                  <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                    <span>Factura: <b>{grp.invoiceCode ? grp.invoiceCode : '—'}</b></span>
                    {grp.invoiceUrl && (
                      <a className="underline" href={grp.invoiceUrl} target="_blank" rel="noreferrer">
                        Ver factura (PDF)
                      </a>
                    )}

                    <span>· Guía: <b>{grp.guiaCode ? grp.guiaCode : '—'}</b></span>
                    {grp.guiaUrl && (
                      <a className="underline" href={grp.guiaUrl} target="_blank" rel="noreferrer">
                        Ver guía (PDF)
                      </a>
                    )}

                    {grp.creditNoteCode && (
                      <Badge variant="secondary">NC: {grp.creditNoteCode}</Badge>
                    )}
                    {grp.creditNoteUrl && (
                      <a className="underline" href={grp.creditNoteUrl} target="_blank" rel="noreferrer">
                        Ver NC (PDF)
                      </a>
                    )}
                  </div>

                  <div className="flex-1" />

                  <div className="text-sm text-muted-foreground">
                    Subtotal: {fmtMoney(grp.subtotal)} {grp.currency} ·{' '}
                    <b>Total (c/IGV): {fmtMoney(grp.totalConIGV)} {grp.currency}</b>
                  </div>
                </div>

                {/* Tabla líneas de la entrega */}
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Peso</TableHead>
                        <TableHead>Precio</TableHead>
                        <TableHead>Subtotal</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grp.lines.map((d, idx) => {
                        const totalLinea = (Number(d.subtotal||0) * (1 + IGV))
                        return (
                          <TableRow key={`${d.deliveryId}-${d.lineId}-${idx}`}>
                            <TableCell>{fmtKg(d.peso)} kg</TableCell>
                            <TableCell>{d.unitPrice ? fmtMoney(d.unitPrice) : '0.00'} {d.currency || ''}</TableCell>
                            <TableCell>{fmtMoney(d.subtotal)} {d.currency || ''}</TableCell>
                            <TableCell>{fmtMoney(totalLinea)} {d.currency || ''}</TableCell>
                          </TableRow>
                        )
                      })}
                      <TableRow className="font-semibold">
                        <TableCell>Total</TableCell>
                        <TableCell />
                        <TableCell>{fmtMoney(grp.subtotal)} {grp.currency}</TableCell>
                        <TableCell>{fmtMoney(grp.totalConIGV)} {grp.currency}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {msg && <div className="text-sm text-muted-foreground">{msg}</div>}
      </CardContent>

      {/* Dialog (modal) para crear entrega — se mantiene tu componente */}
      <CreateDeliveryModal
        open={openCreate}
        onClose={()=>setOpenCreate(false)}
        order={{
          id: order.id,
          customerId: order.customerId,
          lines: lines.map(l => ({
            id: l.id,
            productId: l.productId,
            productName: l.productName,
            presentacion: l.presentacion ?? null,
            pendiente: l.pendiente
          }))
        }}
        onDone={async ()=>{ setOpenCreate(false); await load(); }}
      />
    </Card>
  )
}
