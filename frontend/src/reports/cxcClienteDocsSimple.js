// frontend/src/reports/cxcClienteDocsSimple.js

const fmt = n => (Number(n)||0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = d => d ? new Date(d).toLocaleDateString() : '—'
const fmtDateTime = d => d ? new Date(d).toLocaleString() : '—'

// Normaliza una “fila documento” a partir de una entrega
function normalizeDocRow(row) {
  const facturaFecha = row.invoiceDate || row.FECHA_FACTURA || row.fecha || null
  return {
    invoiceCode: row.invoiceCode || null,
    guiaCode: row.guiaCode || null,
    invoicePath: row.invoicePath || null,
    guiaPath: row.guiaPath || null,
    total: Number(row.total || 0),
    pagado: Number(row.pagado || 0),
    saldo: Number(row.saldo || 0),
    fechaFactura: facturaFecha,
    orderId: row.orderId,
    deliveryId: row.deliveryId
  }
}

/**
 * HTML “Resumen por Documentos” (tipo planilla/Excel):
 *  TD | FEC.EMI | NÚMERO | GUÍAS | MONTO | PAGADO | SALDO
 * Agrupa por invoiceCode (si no hay invoiceCode muestra “—”).
 */
export function buildCxCDocsSummaryHTML({ company, client, items }) {
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
        total: 0, pagado: 0, saldo: 0
      })
    }
    const g = byInvoice.get(key)
    if (row.guiaCode) g.guiaCodes.add(row.guiaCode)
    if (row.guiaPath) g.guiaPaths.add(row.guiaPath)
    if (!g.fechaFactura && row.fechaFactura) g.fechaFactura = row.fechaFactura
    g.total  += row.total
    g.pagado += row.pagado
    g.saldo  += row.saldo
  }

  const rows = Array.from(byInvoice.values())
  const totalMonto   = rows.reduce((a, r)=> a + r.total, 0)
  const totalPagado  = rows.reduce((a, r)=> a + r.pagado, 0)
  const totalSaldo   = rows.reduce((a, r)=> a + r.saldo, 0)

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
  .hdr { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 10px; }
  table { width:100%; border-collapse: collapse; }
  th, td { padding: 8px 10px; border: 1px solid #d1d5db; font-size: 13px; }
  th { text-align:left; background:#f3f4f6; color:#374151; }
  tfoot td { font-weight:700; background:#f9fafb; }
  .num { text-align: right; }
  .small { font-size: 12px; }
  .right { text-align: right; }
  @media print { .no-print { display: none; } body { margin: 0.8cm; } }
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
      <div class="small">${fmtDateTime(new Date())}</div>
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
        <th>NÚMERO</th>
        <th>GUÍA(S)</th>
        <th class="num" style="width:130px;">Monto Total</th>
        <th class="num" style="width:130px;">Pagado</th>
        <th class="num" style="width:130px;">Saldo</th>
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
        <td colspan="4" class="right">Totales</td>
        <td class="num">${fmt(totalMonto)}</td>
        <td class="num">${fmt(totalPagado)}</td>
        <td class="num">${fmt(totalSaldo)}</td>
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
 * HTML “Historial de pagos por Factura” (grid tipo planilla):
 *  Cabecera con totales de la(s) entrega(s) de la factura
 *  Tabla de pagos: Fecha | Método | Referencia | Monto
 */
export function buildInvoicePaymentsHTML_Grid({ company, client, invoiceCode, rows, payments }) {
  const total = (rows||[]).reduce((a,r)=> a + Number(r.total||0), 0)
  const pagado = (rows||[]).reduce((a,r)=> a + Number(r.pagado||0), 0)
  const saldo = (rows||[]).reduce((a,r)=> a + Number(r.saldo||0), 0)

  return `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Pagos de ${invoiceCode}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 24px; color: #111827; }
  h1 { margin: 0 0 4px; font-size: 20px; }
  h2 { margin: 0 0 12px; font-size: 16px; font-weight: 600; color:#374151; }
  .muted { color:#6b7280; }
  .hdr { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 10px; }
  table { width:100%; border-collapse: collapse; }
  th, td { padding: 8px 10px; border: 1px solid #d1d5db; font-size: 13px; }
  th { text-align:left; background:#f3f4f6; color:#374151; }
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

  <table style="margin-bottom:14px">
    <thead>
      <tr>
        <th>Factura</th>
        <th class="num">Monto</th>
        <th class="num">Pagado</th>
        <th class="num">Saldo</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${invoiceCode || '—'}</td>
        <td class="num">${fmt(total)}</td>
        <td class="num">${fmt(pagado)}</td>
        <td class="num">${fmt(saldo)}</td>
      </tr>
    </tbody>
  </table>

  <h2>Historial de Pagos</h2>
  <table>
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Método</th>
        <th>Referencia</th>
        <th class="num">Monto</th>
      </tr>
    </thead>
    <tbody>
      ${(payments || []).map(p => `
        <tr>
          <td>${fmtDateTime(p.paymentDate || p.PAYMENT_DATE)}</td>
          <td>${p.method || p.METHOD}</td>
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
