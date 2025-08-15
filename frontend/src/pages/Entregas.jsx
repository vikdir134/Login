export default function Entregas() {
  return (
    <section className="card">
      <h3 style={{ marginTop: 0 }}>Entregas</h3>
      {/* AQUÍ (ejemplo SELECT):
         SELECT id, pedido_id, fecha_entrega, estado
         FROM entregas
         ORDER BY fecha_entrega DESC
         LIMIT 50;
      */}
      <p className="muted">Contenido de Entregas (placeholder)…</p>
    </section>
  )
}
