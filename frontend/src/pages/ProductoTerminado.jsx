export default function ProductoTerminado() {
  return (
    <section className="card">
      <h3 style={{ marginTop: 0 }}>Producto Terminado</h3>
      {/* AQUÍ (ejemplo SELECT):
         SELECT id, nombre, lote, fecha, cantidad
         FROM producto_terminado
         ORDER BY fecha DESC
         LIMIT 50;
      */}
      <p className="muted">Contenido de Producto Terminado (placeholder)…</p>
    </section>
  )
}
