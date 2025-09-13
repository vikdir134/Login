// frontend/src/reports/cxcClienteReport.js
const fmt = n => (Number(n)||0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = d => d ? new Date(d).toLocaleDateString() : '—'
const fmtDateTime = d => d ? new Date(d).toLocaleString() : new Date().toLocaleString()

// Normaliza una fila “documento” a partir de una entrega (items de CxC Cliente)
function normalizeDocRow(row) {
  return {
    invoiceCode: row.invoiceCode || null,
    guiaCode: row.guiaCode || null,
    invoicePath: row.invoicePath || null,
    guiaPath: row.guiaPath || null,
    fechaFactura: row.invoiceDate || row.FECHA_FACTURA || row.fecha || null, // si no traes fecha de factura, usamos fecha de entrega
    total: Number(row.total || 0),
    pagado: Number(row.pagado || 0),
    saldo: Number(row.saldo || 0),
    orderId: row.orderId,
  }
}

/**
 * Informe “simple” por Documentos (como el ejemplo).
 * - Agrupa por invoiceCode (si no hay, va como “—”).
 * - Muestra: TD, FEC. EMI., NÚMERO, GUÍA(s), MONTO ORIGINAL, SALDO.
 * - Totales al pie (original y saldo).
 *
 * @param {Object} params
 * @param {{name:string, ruc?:string}} params.company
 * @param {{customerName:string, RUC?:string}} params.client
 * @param {Array} params.items  // Entregas del cliente (cada una con invoiceCode/guiaCode/total/pagado/saldo/fecha...)
 * @param {Map<number, Array>} [params.paymentsByOrder]  // No se usa aquí, pero se mantiene compat para llamadas previas
 * @param {'all'|'with'|'without'} [params.balance]      // Solo para mostrar etiqueta
 */
export function buildCxCClienteReportHTML({ company, client, items, balance }) {
  // Agrupar por factura
  const byInvoice = new Map()
  for (const it of (items || [])) {
    const row = normalizeDocRow(it)
    const key = row.invoiceCode || '—'
    if (!byInvoice.has(key)) {
      byInvoice.set(key, {
        invoiceCode: row.invoiceCode || '—',
        guiaCodes: new Set(),
        fechaFactura: row.fechaFactura,
        total: 0, pagado: 0, saldo: 0,
      })
    }
    const g = byInvoice.get(key)
    if (row.guiaCode) g.guiaCodes.add(row.guiaCode)
    if (!g.fechaFactura && row.fechaFactura) g.fechaFactura = row.fechaFactura
    g.total  += row.total
    g.pagado += row.pagado
    g.saldo  += row.saldo
  }

  const rows = Array.from(byInvoice.values())
  const totalOriginal = rows.reduce((a, r)=> a + r.total, 0)
  const totalSaldo    = rows.reduce((a, r)=> a + r.saldo, 0)
  const todayTxt = fmtDateTime(new Date())
  const balanceLabel = balance === 'with' ? 'Solo con saldo'
                     : balance === 'without' ? 'Pagados'
                     : 'Todos'

  return `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>CxC · ${client?.customerName || ''}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 24px; color: #111827; }
  h1 { margin: 0 0 4px; font-size: 20px; }
  h2 { margin: 0 0 16px; font-size: 16px; font-weight: 600; color:#374151; }
  .muted { color:#6b7280; }
  .hdr { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 10px; }
  .chip{ display:inline-block; border:1px solid #e5e7eb; color:#334155; padding:3px 8px; border-radius:999px; font-size:12px; font-weight:600; }
  table { width:100%; border-collapse: collapse; }
  th, td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
  th { text-align:left; background:#f9fafb; color:#374151; }
  tfoot td { font-weight:700; }
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
      <div class="small">${todayTxt}</div>
      <div class="chip" style="margin-top:6px">${balanceLabel}</div>
    </div>
  </div>

  <div style="margin-bottom:12px;">
    <div><strong>${client?.customerName || ''}</strong></div>
    <div class="muted small">${client?.RUC ? ('RUC: ' + client.RUC) : ''}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:90px;">TD</th>
        <th style="width:110px;">FEC. EMI.</th>
        <th>NÚMERO</th>
        <th>GUÍA(S)</th>
        <th class="num" style="width:130px;">Monto Original</th>
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
            <td class="num">${fmt(r.saldo)}</td>
          </tr>
        `
      }).join('')}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4" class="right">Sub Total:</td>
        <td class="num">${fmt(totalOriginal)}</td>
        <td class="num">${fmt(totalSaldo)}</td>
      </tr>
      <tr>
        <td colspan="4" class="right">Total x Cliente:</td>
        <td class="num">${fmt(totalOriginal)}</td>
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
 * Variante para imprimir **una factura** con su historial de pagos.
 * @param {Object} p
 * @param {{name:string, ruc?:string}} p.company
 * @param {{customerName:string, RUC?:string}} p.client
 * @param {string} p.invoiceCode
 * @param {Array} p.rows       // filas (entregas) que pertenecen a esa factura
 * @param {Array} p.payments   // pagos (acumulados de los pedidos involucrados)
 */
export function buildInvoicePaymentsHTML({ company, client, invoiceCode, rows, payments }) {
  const total = rows.reduce((a,r)=> a + Number(r.total||0), 0)
  const pagado = rows.reduce((a,r)=> a + Number(r.pagado||0), 0)
  const saldo = rows.reduce((a,r)=> a + Number(r.saldo||0), 0)
  const fmtDateTimeLocal = d => d ? new Date(d).toLocaleString() : '—'
  const fmtDateLocal = d => d ? new Date(d).toLocaleDateString() : '—'

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
  th, td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
  th { text-align:left; background:#f9fafb; color:#374151; }
  tfoot td { font-weight:700; }
  .num { text-align: right; }
  .small { font-size:12px; }
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
      <div class="small">${new Date().toLocaleString()}</div>
    </div>
  </div>

  <div style="margin-bottom:12px;">
    <div><strong>${client?.customerName || ''}</strong></div>
    <div class="muted small">${client?.RUC ? ('RUC: ' + client.RUC) : ''}</div>
  </div>

  <table style="margin-bottom:14px">
    <thead>
      <tr>
        <th>Entrega</th>
        <th>Fecha</th>
        <th class="num">Monto</th>
        <th class="num">Pagado</th>
        <th class="num">Saldo</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(r => `
        <tr>
          <td>#${r.deliveryId ?? '—'}</td>
          <td>${fmtDateLocal(r.fecha)}</td>
          <td class="num">${fmt(r.total||0)}</td>
          <td class="num">${fmt(r.pagado||0)}</td>
          <td class="num">${fmt(r.saldo||0)}</td>
        </tr>
      `).join('')}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2" class="num" style="text-align:right;">Totales</td>
        <td class="num">${fmt(total)}</td>
        <td class="num">${fmt(pagado)}</td>
        <td class="num">${fmt(saldo)}</td>
      </tr>
    </tfoot>
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
          <td>${fmtDateTimeLocal(p.paymentDate || p.PAYMENT_DATE)}</td>
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
