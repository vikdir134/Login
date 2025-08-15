export default function Clientes() {
  return (
    <section className="card">
      <h3 style={{ marginTop: 0 }}>Clientes</h3>
      {/* AQUÍ: tabla de clientes.
         SELECT id, nombre, ruc, email, estado FROM clientes ORDER BY nombre LIMIT 50;
      */}
      <p className="muted">Listado de clientes…</p>
    </section>
  )
}
