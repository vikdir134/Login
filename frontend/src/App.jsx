import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import ProtectedRoute from './components/ProtectedRoute'
import RequireRole from './components/RequireRole'

import DashboardLayout from './layouts/DashboardLayout'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import Pedidos from './pages/Pedidos'
import Almacen from './pages/Almacen'
import ProductoTerminado from './pages/ProductoTerminado'
import Entregas from './pages/Entregas'
import Pagos from './pages/Pagos'
import RegistroUsuarios from './pages/RegistroUsuarios'
import Compras from './pages/Compras'
import DefaultByRole from './components/DefaultByRole' // nuevo (abajo)
import ClienteDetalle from './pages/ClienteDetalle'
import PedidoDetalle from './pages/PedidoDetalle'
import PedidosProceso from './pages/PedidosProceso'
import EntregaDetalle from './pages/EntregaDetalle'
import CuentasPorCobrar from './pages/CuentasPorCobrar'
import CuentasPorCobrarCliente from './pages/CuentasPorCobrarCliente'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} /><Route
        path="/app"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        {/* Inicio: redirige según rol */}
        <Route index element={<DefaultByRole />} />
        <Route path="cxc" element={
  <RequireRole roles={['JEFE','ADMINISTRADOR']}><CuentasPorCobrar /></RequireRole>
} />
<Route path="cxc/:id" element={
  <RequireRole roles={['JEFE','ADMINISTRADOR']}><CuentasPorCobrarCliente /></RequireRole>
} />

        {/* JEFE y ADMIN ven Dashboard, Clientes, Pagos */}
        <Route path="clientes" element={
          <RequireRole roles={['JEFE','ADMINISTRADOR','PRODUCCION','ALMACENERO']}><Clientes /></RequireRole>
        } />
        <Route path="clientes/:id" element={
          <RequireRole roles={['JEFE','ADMINISTRADOR','PRODUCCION']}><ClienteDetalle /></RequireRole>
        } />
        <Route path="pedidos/:id" element={
          <RequireRole roles={['JEFE','ADMINISTRADOR','PRODUCCION','ALMACENERO']}><PedidoDetalle /></RequireRole>
        } />
        <Route path="pagos" element={
          <RequireRole roles={['JEFE','ADMINISTRADOR']}><Pagos /></RequireRole>
        } />
        <Route index path="" element={
          <RequireRole roles={['JEFE','ADMINISTRADOR']}><Dashboard /></RequireRole>
        } />

        {/* PRODUCCION puede ver Pedidos (además de los de almacén) */}
        <Route path="pedidos" element={
          <RequireRole roles={['PRODUCCION','JEFE','ADMINISTRADOR']}><Pedidos /></RequireRole>
        } />

        <Route path="compras" element={
          <RequireRole roles={['ALMACENERO','JEFE','ADMINISTRADOR']}><Compras /></RequireRole>
        } />

        {/* Almacén / Producto Terminado / Entregas (muchos roles) */}
        <Route path="almacen" element={
          <RequireRole roles={['ALMACENERO','PRODUCCION','JEFE','ADMINISTRADOR']}><Almacen /></RequireRole>
        } />
        <Route path="producto-terminado" element={
          <RequireRole roles={['ALMACENERO','PRODUCCION','JEFE','ADMINISTRADOR']}><ProductoTerminado /></RequireRole>
        } />
        <Route path="entregas" element={
          <RequireRole roles={['ALMACENERO','PRODUCCION','JEFE','ADMINISTRADOR']}><Entregas /></RequireRole>
        } />
        {/* NUEVO: flujo de entregas */}
        <Route path="entregas/nueva" element={
          <RequireRole roles={['PRODUCCION','JEFE','ADMINISTRADOR']}><PedidosProceso /></RequireRole>
        } />
        <Route path="entregas/orden/:id" element={
          <RequireRole roles={['ALMACENERO','PRODUCCION','JEFE','ADMINISTRADOR']}><EntregaDetalle /></RequireRole>
        } />
        {/* Solo ADMIN registra usuarios */}
        <Route path="registro-usuarios" element={
          <RequireRole roles={['ADMINISTRADOR']}><RegistroUsuarios /></RequireRole>
        } />
      </Route>

      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}
