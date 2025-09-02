const fmt = n => (Number(n)||0).toFixed(2);
const fmtDate = d => new Date(d).toLocaleDateString();
const fmtDateTime = d => new Date(d).toLocaleString();

/**
 * Construye el HTML del informe de CxC por cliente (estilizado).
 * @param {Object} params
 * @param {{name:string,ruc:string,address?:string,phone?:string,email?:string}} params.company
 * @param {{customerName:string, RUC:string, totalPedidosPEN:number, totalPagadoPEN:number, saldoPEN:number}} params.client
 * @param {Array<{orderId:number,fecha:string,estado:string,total:number,pagado:number,saldo:number,invoices?:string}>} params.items
 * @param {Map<number, Array>} params.paymentsByOrder  // orderId -> pagos[]
 * @param {'all'|'with'|'without'} params.balance
 */
export function buildCxCClienteReportHTML({ company, client, items, paymentsByOrder, balance }) {
  const todayTxt = fmtDateTime(new Date());
  const balanceLabel = balance === 'with' ? 'Solo con saldo'
                     : balance === 'without' ? 'Pagados'
                     : 'Todos';

  const estadoBadge = (estado='') => {
    const up = String(estado).toUpperCase();
    const color =
      up === 'ENTREGADO'   ? '#16a34a' :
      up === 'EN_PROCESO'  ? '#d97706' :
      up === 'PENDIENTE'   ? '#ef4444' :
      up === 'CANCELADO'   ? '#6b7280' : '#334155';
    const bg = color + '22';
    return `<span class="chip" style="background:${bg};color:${color};border-color:${color}33">${estado || '—'}</span>`;
  };

  const headHtml = `
    <header class="header">
      <div class="brand">
        <div class="brand__name">${company.name}</div>
        <div class="brand__meta">RUC: ${company.ruc}</div>
        ${company.address ? `<div class="brand__meta">${company.address}</div>` : ''}
        ${company.phone ? `<div class="brand__meta">${company.phone}</div>` : ''}
        ${company.email ? `<div class="brand__meta">${company.email}</div>` : ''}
      </div>
      <div class="titlebox">
        <div class="title">Informe de Cuentas por Cobrar</div>
        <div class="subtitle">Generado: ${todayTxt}</div>
        <div class="chip chip--ghost" style="margin-top:6px">${balanceLabel}</div>
      </div>
    </header>

    <hr class="rule" />

    <section class="client">
      <div class="client__id">
        <div><b>Cliente:</b> ${client.customerName}</div>
        <div><b>RUC:</b> ${client.RUC}</div>
      </div>
      <div class="kpis">
        <div class="kpi">
          <div class="kpi__label">Total</div>
          <div class="kpi__value">S/ ${fmt(client.totalPedidosPEN)}</div>
        </div>
        <div class="kpi">
          <div class="kpi__label">Pagado</div>
          <div class="kpi__value kpi__value--ok">S/ ${fmt(client.totalPagadoPEN)}</div>
        </div>
        <div class="kpi">
          <div class="kpi__label">Saldo</div>
          <div class="kpi__value kpi__value--warn">S/ ${fmt(client.saldoPEN)}</div>
        </div>
      </div>
    </section>
  `;

  const rowsHtml = (items||[]).map((it, idx) => {
    const pagos = paymentsByOrder.get(it.orderId) || [];
    const totalPagos = pagos.reduce((a,p)=> a + Number(p.amount || p.AMOUNT || 0), 0);
    const zebra = (i) => (i % 2 === 0 ? 'row--zebra' : '');

    const pagosHtml = pagos.length
      ? `
        <table class="tbl">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Método</th>
              <th>Operación</th>
              <th>Observación</th>
              <th style="text-align:right">Monto</th>
            </tr>
          </thead>
          <tbody>
            ${pagos.map((p,i) => `
              <tr class="${zebra(i)}">
                <td>${fmtDate(p.paymentDate || p.PAYMENT_DATE)}</td>
                <td>${p.method || p.METHOD}</td>
                <td>${p.reference || p.REFERENCE || ''}</td>
                <td>${p.notes || p.OBSERVACION || ''}</td>
                <td style="text-align:right">${fmt(p.amount || p.AMOUNT)} ${p.currency || p.CURRENCY || 'PEN'}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4" style="text-align:right"><b>Total pagos</b></td>
              <td style="text-align:right"><b>${fmt(totalPagos)} PEN</b></td>
            </tr>
          </tfoot>
        </table>
      `
      : `<div class="muted small">Sin pagos</div>`;

    return `
      <section class="order ${ (idx+1) % 4 === 0 ? 'page-break-avoid' : '' }">
        <div class="order__head">
          <div class="order__left">
            <div class="order__title">Pedido #${it.orderId}</div>
            <div class="order__meta">
              <span>${fmtDateTime(it.fecha)}</span>
              <span>·</span>
              <span>Facturas: ${it.invoices || '—'}</span>
              <span>·</span>
              ${estadoBadge(it.estado)}
            </div>
          </div>
          <div class="order__figures">
            <div class="figure"><span>Total</span><b>S/ ${fmt(it.total)}</b></div>
            <div class="figure"><span>Pagado</span><b>S/ ${fmt(it.pagado)}</b></div>
            <div class="figure"><span>Saldo</span><b class="${Number(it.saldo)<=0.0001 ? 'ok' : ''}">S/ ${fmt(it.saldo)}</b></div>
          </div>
        </div>

        <div class="divider"></div>

        ${pagosHtml}
      </section>
    `;
  }).join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Informe CxC - ${client.customerName}</title>
  <style>
    :root{
      --ink:#0f172a;
      --muted:#64748b;
      --rule:#e2e8f0;
      --card:#f8fafc;
      --ok:#15803d;
      --warn:#b91c1c;
      --chip:#334155;
      --chip-bg:#e2e8f0;
      --shadow: 0 2px 10px rgba(15, 23, 42, .06);
    }
    @media print{
      @page{ margin:16mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page-break-avoid{ break-inside: avoid; }
    }
    *{ box-sizing: border-box; }
    body{
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      color: var(--ink);
      margin: 24px;
      font-size: 14px;
      line-height: 1.35;
    }
    .muted{ color: var(--muted); }
    .small{ font-size: 12px; }
    .rule{
      border: 0; border-top: 1px solid var(--rule); margin: 12px 0 16px;
    }

    /* Header */
    .header{ display:flex; justify-content:space-between; align-items:flex-start; gap:16px; }
    .brand__name{ font-size:20px; font-weight:700; }
    .brand__meta{ color:var(--muted); }
    .titlebox{ text-align:right; }
    .title{ font-size:18px; font-weight:700; }
    .subtitle{ color:var(--muted); }

    /* Chips */
    .chip{
      display:inline-block;
      border:1px solid var(--chip-bg);
      background:var(--chip-bg);
      color:var(--chip);
      padding:3px 8px;
      border-radius:999px;
      font-size:12px;
      font-weight:600;
    }
    .chip--ghost{
      background:transparent;
    }

    /* Cliente + KPIs */
    .client{
      display:flex; justify-content:space-between; align-items:flex-start; gap:16px;
      margin: 8px 0 4px;
    }
    .kpis{
      display:grid; grid-template-columns: repeat(3, minmax(0, 140px)); gap:10px;
    }
    .kpi{
      background: var(--card);
      padding:10px 12px;
      border:1px solid var(--rule);
      border-radius:10px;
      box-shadow: var(--shadow);
      min-width:140px;
    }
    .kpi__label{ color:var(--muted); font-size:12px; }
    .kpi__value{ font-weight:700; font-size:18px; }
    .kpi__value--ok{ color: var(--ok); }
    .kpi__value--warn{ color: var(--warn); }

    /* Pedido */
    .order{
      border:1px solid var(--rule);
      border-radius:12px;
      padding:12px;
      margin:14px 0;
      box-shadow: var(--shadow);
      background: white;
      break-inside: avoid;
    }
    .order__head{
      display:flex; justify-content:space-between; align-items:flex-start; gap:12px;
    }
    .order__title{ font-weight:700; font-size:15px; }
    .order__meta{ color:var(--muted); display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
    .order__figures{
      display:flex; gap:12px; align-items:flex-end; text-align:right;
    }
    .figure span{ display:block; color:var(--muted); font-size:12px; }
    .figure b{ font-size:14px; }
    .figure b.ok{ color: var(--ok); }

    .divider{
      height:1px; background:linear-gradient(to right, transparent, var(--rule), transparent);
      margin:10px 0 8px;
    }

    /* Tabla de pagos */
    .tbl{
      width:100%; border-collapse:collapse; font-size:12px;
    }
    .tbl th, .tbl td{
      padding:8px; border:1px solid #eef2f7;
    }
    .tbl thead th{
      background:#f1f5f9; text-align:left;
    }
    .tbl tfoot td{
      background:#f8fafc;
    }
    .row--zebra td{
      background:#fcfdff;
    }
  </style>
</head>
<body>
  ${headHtml}

  <h3 style="margin: 12px 0 6px;">Pedidos</h3>
  <div class="muted small" style="margin-bottom:8px">
    Vista: <span class="chip">${balanceLabel}</span>
  </div>

  ${rowsHtml || '<div class="muted">No hay pedidos en este filtro.</div>'}
</body>
</html>`;
}
