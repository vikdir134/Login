// frontend/src/reports/cxcClienteDocsSimple.js

const fmt = n =>
  (Number(n) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
const fmtDate = d => (d ? new Date(d).toLocaleDateString() : '—')
const fmtDateTime = d => (d ? new Date(d).toLocaleString() : '—')

// Normaliza una “fila documento” a partir de una entrega
function normalizeDocRow(row) {
  // Tomamos la fecha de la factura si existe; si no, la fecha de la entrega
  const facturaFecha = row.invoiceDate || row.FECHA_FACTURA || row.fecha || null

  return {
    // claves para identificar/mostrar
    invoiceCode: row.invoiceCode || null,
    guiaCode: row.guiaCode || null,
    invoicePath: row.invoicePath || null,
    guiaPath: row.guiaPath || null,

    // montos
    total: Number(row.total || 0),
    pagado: Number(row.pagado || 0),
    saldo: Number(row.saldo || 0),

    // fechas/ids
    fechaFactura: facturaFecha,
    orderId: row.orderId,
  }
}

/**
 * RESUMEN POR DOCUMENTOS (tipo extracto Excel)
 * Agrupa por invoiceCode (si no hay invoiceCode muestra “—”).
 * Columnas: TD | FEC. EMI. | NÚMERO | GUÍA(S) | MONTO | PAGADO | SALDO
 */
export function buildCxCDocsSummaryHTML({ company, client, items }) {
  // Agrupar por factura
  const byInvoice = new Map()
  for (const it of (items || [])) {
    const row = normalizeDocRow(it)
    const key = row.invoiceCode || '—'
    if (!byInvoice.has(key)) {
      byInvoice.set(key, {
        invoiceCode: row.invoiceCode || '—',
        guiaCodes: new Set(),
        invoicePath: row.invoicePath || null,
        guiaPaths: new Set(),
        fechaFactura: row.fechaFactura,
        total: 0, pagado: 0, saldo: 0,
        orders: new Set(),
      })
    }
    const g = byInvoice.get(key)
    if (row.guiaCode) g.guiaCodes.add(row.guiaCode)
    if (row.guiaPath) g.guiaPaths.add(row.guiaPath)
    if (!g.fechaFactura && row.fechaFactura) g.fechaFactura = row.fechaFactura

    g.total  += row.total
    g.pagado += row.pagado
    g.saldo  += row.saldo
    if (row.orderId) g.orders.add(row.orderId)
  }

  const rows = Array.from(byInvoice.values())

  const totalMonto  = rows.reduce((a, r)=> a + r.total,  0)
  const totalPagado = rows.reduce((a, r)=> a + r.pagado, 0)
  const totalSaldo  = rows.reduce((a, r)=> a + r.saldo,  0)

  return `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Resumen por Documentos</title>
<style>
  body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 24px; color: #111827; }
  h1 { margin: 0 0 4px; font-size: 20px; }
  h2 { margin: 0 0 16px; font-size: 16px; font-weight: 600; color:#374151; }
  .muted { color:#6b7280; }
  .hdr { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 12px; }
  table { width:100%; border-collapse: collapse; table-layout: fixed; }
  th, td { padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 13px; }
  th { text-align:left; background:#e5e7eb; color:#111827; }
  .num { text-align: right; }
  .small { font-size: 12px; }
  .right { text-align: right; }
  @media print {
    .no-print { display: none; }
    body { margin: 0.8cm; }
  }
</style>
</head>
<body>
  <div class="hdr">
    <div>
      <h1>${company?.name || 'Empresa'}</h1>
      <div class="muted small">${company?.ruc ? ('RUC: ' + company.ruc) : ''}</div>
    </div>
    <div class="right">
      <h2>Resumen por Documentos</h2>
      <div class="small">${new Date().toLocaleString()}</div>
    </div>
  </div>

  <div style="margin-bottom:12px;">
    <div><strong>${client?.customerName || ''}</strong></div>
    <div class="muted small">${client?.RUC ? ('RUC: ' + client.RUC) : ''}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:70px;">TD</th>
        <th style="width:110px;">FEC. EMI.</th>
        <th style="width:180px;">NÚMERO</th>
        <th>GUÍA(S)</th>
        <th class="num" style="width:120px;">MONTO</th>
        <th class="num" style="width:120px;">PAGADO</th>
        <th class="num" style="width:120px;">SALDO</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(r => {
        const TD = r.invoiceCode && r.invoiceCode !== '—' ? 'FV' : '—'
        const guiaText = r.guiaCodes.size ? Array.from(r.guiaCodes).join(', ') : '—'
        return `
          <tr>
            <td>${TD}</td>
            <td>${fmtDate(r.fechaFactura)}</td>
            <td>${r.invoiceCode}</td>
            <td>${guiaText}</td>
            <td class="num">${fmt(r.total)}</td>
            <td class="num">${fmt(r.pagado)}</td>
            <td class="num">${fmt(r.saldo)}</td>
          </tr>
        `
      }).join('')}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4" class="right"><b>Totales</b></td>
        <td class="num"><b>${fmt(totalMonto)}</b></td>
        <td class="num"><b>${fmt(totalPagado)}</b></td>
        <td class="num"><b>${fmt(totalSaldo)}</b></td>
      </tr>
    </tfoot>
  </table>

  <div class="no-print" style="margin-top:16px;">
    <button onclick="window.print()">Imprimir</button>
  </div>
</body>
</html>
  `
}

/**
 * PAGOS DE UNA FACTURA (formato simple con cuadros)
 * Resumen de Factura: Factura | Fecha | Monto | Pagado | Saldo
 * Historial de Pagos: Fecha | Método | Referencia | Monto
 */
export function buildInvoicePaymentsHTML({ company, client, invoiceCode, rows, payments }) {
  // Totales de la factura (sumando entregas de esa factura)
  const totalFactura = (rows || []).reduce((a,r)=> a + Number(r.total||0), 0)
  const totalPagado  = (rows || []).reduce((a,r)=> a + Number(r.pagado||0), 0)
  const totalSaldo   = (rows || []).reduce((a,r)=> a + Number(r.saldo||0),  0)

  // Fecha de la factura (si alguna fila la trae)
  const facturaFecha =
    (rows || []).find(r => r.invoiceDate || r.FECHA_FACTURA)?.invoiceDate ||
    (rows || []).find(r => r.invoiceDate || r.FECHA_FACTURA)?.FECHA_FACTURA ||
    (rows && rows[0]?.fecha) || null

  return `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Pagos de ${invoiceCode}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 24px; color: #111827; }
  h1 { margin: 0 0 4px; font-size: 20px; }
  h2 { margin: 14px 0 8px; font-size: 16px; font-weight: 600; color:#374151; }
  .muted { color:#6b7280; }
  .hdr { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 12px; }
  table { width:100%; border-collapse: collapse; table-layout: fixed; }
  th, td { padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 13px; }
  th { text-align:left; background:#e5e7eb; color:#111827; }
  .num { text-align: right; }
  .small { font-size:12px; }
  .right { text-align:right; }
  @media print { .no-print{ display:none } body{ margin:0.8cm } }
</style>
</head>
<body>
  <div class="hdr">
    <div>
      <h1>${company?.name || 'Empresa'}</h1>
      <div class="muted small">${company?.ruc ? ('RUC: ' + company.ruc) : ''}</div>
    </div>
    <div class="right">
      <h2>Pagos de Factura ${invoiceCode}</h2>
      <div class="small">${fmtDateTime(new Date())}</div>
    </div>
  </div>

  <div style="margin-bottom:12px;">
    <div><strong>${client?.customerName || ''}</strong></div>
    <div class="muted small">${client?.RUC ? ('RUC: ' + client.RUC) : ''}</div>
  </div>

  <!-- Resumen de la factura -->
  <table style="margin-bottom:14px">
    <thead>
      <tr>
        <th style="width:220px;">Factura</th>
        <th style="width:120px;">Fecha</th>
        <th class="num" style="width:120px;">Monto</th>
        <th class="num" style="width:120px;">Pagado</th>
        <th class="num" style="width:120px;">Saldo</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${invoiceCode || '—'}</td>
        <td>${fmtDate(facturaFecha)}</td>
        <td class="num">${fmt(totalFactura)}</td>
        <td class="num">${fmt(totalPagado)}</td>
        <td class="num">${fmt(totalSaldo)}</td>
      </tr>
    </tbody>
  </table>

  <!-- Historial de pagos -->
  <h2>Historial de Pagos</h2>
  <table>
    <thead>
      <tr>
        <th style="width:160px;">Fecha</th>
        <th style="width:160px;">Método</th>
        <th>Referencia</th>
        <th class="num" style="width:140px;">Monto</th>
      </tr>
    </thead>
    <tbody>
      ${(payments || []).map(p => `
        <tr>
          <td>${fmtDateTime(p.paymentDate || p.PAYMENT_DATE)}</td>
          <td>${p.method || p.METHOD || ''}</td>
          <td>${p.reference || p.REFERENCE || '—'}</td>
          <td class="num">${fmt(p.amount || p.AMOUNT)}</td>
        </tr>
      `).join('')}
      ${(!payments || !payments.length) ? `<tr><td colspan="4" class="muted">Sin pagos</td></tr>` : ''}
    </tbody>
  </table>

  <div class="no-print" style="margin-top:16px;">
    <button onclick="window.print()">Imprimir</button>
  </div>
</body>
</html>
  `
}
