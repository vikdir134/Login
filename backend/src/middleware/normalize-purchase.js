// src/middleware/normalize-purchase.js
export function normalizePurchase(req, _res, next) {
  const b = req.body ?? {};

  // Aliases → canon
  b.supplierId     ??= b.idSupplier ?? b.proveedorId ?? b.supplier_id;
  b.documentType   ??= b.docType ?? b.document_type;
  b.documentNumber ??= b.docNumber ?? b.document_number;
  b.documentDate   ??= b.fecha ?? b.document_date;

  // Normaliza fecha a YYYY-MM-DD
  if (b.documentDate) {
    try {
      const d = new Date(b.documentDate);
      if (!isNaN(d)) {
        b.documentDate = d.toISOString().slice(0, 10); // YYYY-MM-DD
      }
    } catch {}
  }

  // Asegura array de items
  if (!Array.isArray(b.items)) b.items = [];

  // Normaliza items/aliases
  b.items = b.items.map(it => ({
    primaterId: Number(it.primaterId ?? it.idPrimater ?? it.id_primater ?? it.ID_PRIMATER),
    quantity:   Number(it.quantity   ?? it.qty       ?? it.cantidad),
    unitPrice:  Number(it.unitPrice  ?? it.price     ?? it.unit_price),
    notes:      it.notes ?? null
  }));

  req.body = b;
  next();
}
