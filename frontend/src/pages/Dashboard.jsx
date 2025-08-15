export default function Dashboard() {
  return (
    <section>
      {/* AQUÍ: filtros de fecha, tarjetas de KPIs, y la gráfica principal */}
      {/* Ejemplo de consulta que luego moverás al backend:
         SELECT MONTH(fecha) AS mes, SUM(total) AS ventas
         FROM ventas
         WHERE fecha BETWEEN ? AND ?
         GROUP BY MONTH(fecha)
         ORDER BY MONTH(fecha);
      */}
      <div className="card">
        <p className="muted">Aquí irá “Ventas por mes”, KPIs y últimos pedidos.</p>
      </div>
    </section>
  )
}
