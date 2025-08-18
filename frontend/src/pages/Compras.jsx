export default function Compras() {
  return (
    <section className="card">
      <h3>Compras</h3>
      <p className="muted">Aquí podrás registrar compras y ver el historial.</p>
      {/* TODO:
        - Formulario: proveedor + documento + fecha + ítems (material, cantidad, precio)
        - Botón "Guardar compra" → POST /api/purchases
        - Tabla: últimas compras
      */}
    </section>
  )
}
