export default function Pagos() {
  return (
    <section className="card">
      <h3 style={{ marginTop: 0 }}>Pagos</h3>
      {/* AQUÍ (ejemplo SELECT):
         SELECT id, cliente, fecha, monto, metodo, estado
         FROM pagos
         ORDER BY fecha DESC
         LIMIT 50;
      */}
      <p className="muted">Contenido de Pagos (placeholder)…</p>
    </section>
  )
}
