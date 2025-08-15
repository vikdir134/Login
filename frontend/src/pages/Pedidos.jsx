export default function Pedidos() {
  return (
    <section className="card">
      <h3 style={{ marginTop: 0 }}>Pedidos</h3>
      {/* AQUÍ: tabla de pedidos con estado.
         SELECT id, cliente, fecha, estado, total FROM pedidos ORDER BY fecha DESC LIMIT 50;
      */}
      <p className="muted">Listado de pedidos…</p>
    </section>
  )
}
