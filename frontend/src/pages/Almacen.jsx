export default function Almacen() {
  return (
    <section className="card">
      <h3 style={{ marginTop: 0 }}>Almacén</h3>
      {/* AQUÍ (ejemplo SELECT): 
         SELECT id, codigo, descripcion, stock, unidad
         FROM almacen
         ORDER BY descripcion
         LIMIT 50;
      */}
      <p className="muted">Contenido de Almacén (placeholder)…</p>
    </section>
  )
}
