// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from "@/components/ui/sonner"

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
import Compras from './pages/Compras'

import Pagos from './pages/Pagos'
import RegistroUsuarios from './pages/RegistroUsuarios'
import ClienteDetalle from './pages/ClienteDetalle'
import PedidoDetalle from './pages/PedidoDetalle'
import PedidosProceso from './pages/PedidosProceso'
import EntregaDetalle from './pages/EntregaDetalle'
import CuentasPorCobrar from './pages/CuentasPorCobrar'
import CuentasPorCobrarCliente from './pages/CuentasPorCobrarCliente'

export default function App() {
  return (
    <>
      {/* Toaster global (montar UNA sola vez en la app) */}
      <Toaster richColors closeButton position="top-right" duration={3000} />

      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          {/* Index = Dashboard (lo primero que se ve) */}
          <Route index element={<Dashboard />} />

          {/* CxC */}
          <Route
            path="cxc"
            element={
              <RequireRole roles={['JEFE','ADMINISTRADOR']}>
                <CuentasPorCobrar />
              </RequireRole>
            }
          />
          <Route
            path="cxc/:id"
            element={
              <RequireRole roles={['JEFE','ADMINISTRADOR']}>
                <CuentasPorCobrarCliente />
              </RequireRole>
            }
          />

          {/* Clientes */}
          <Route
            path="clientes"
            element={
              <RequireRole roles={['JEFE','ADMINISTRADOR','PRODUCCION','ALMACENERO']}>
                <Clientes />
              </RequireRole>
            }
          />
          <Route
            path="clientes/:id"
            element={
              <RequireRole roles={['JEFE','ADMINISTRADOR','PRODUCCION']}>
                <ClienteDetalle />
              </RequireRole>
            }
          />

          {/* Pedidos */}
          <Route
            path="pedidos"
            element={
              <RequireRole roles={['PRODUCCION','JEFE','ADMINISTRADOR']}>
                <Pedidos />
              </RequireRole>
            }
          />
          <Route
            path="pedidos/:id"
            element={
              <RequireRole roles={['JEFE','ADMINISTRADOR','PRODUCCION','ALMACENERO']}>
                <PedidoDetalle />
              </RequireRole>
            }
          />

          {/* Compras */}
          <Route
            path="compras"
            element={
              <RequireRole roles={['ALMACENERO','JEFE','ADMINISTRADOR']}>
                <Compras />
              </RequireRole>
            }
          />

          {/* Almacén / PT / Entregas */}
          <Route
            path="almacen"
            element={
              <RequireRole roles={['ALMACENERO','PRODUCCION','JEFE','ADMINISTRADOR']}>
                <Almacen />
              </RequireRole>
            }
          />
          <Route
            path="producto-terminado"
            element={
              <RequireRole roles={['ALMACENERO','PRODUCCION','JEFE','ADMINISTRADOR']}>
                <ProductoTerminado />
              </RequireRole>
            }
          />
          <Route
            path="entregas"
            element={
              <RequireRole roles={['ALMACENERO','PRODUCCION','JEFE','ADMINISTRADOR']}>
                <Entregas />
              </RequireRole>
            }
          />
          <Route
            path="entregas/nueva"
            element={
              <RequireRole roles={['PRODUCCION','JEFE','ADMINISTRADOR']}>
                <PedidosProceso />
              </RequireRole>
            }
          />
          <Route
            path="entregas/orden/:id"
            element={
              <RequireRole roles={['ALMACENERO','PRODUCCION','JEFE','ADMINISTRADOR']}>
                <EntregaDetalle />
              </RequireRole>
            }
          />

          {/* Administración de usuarios */}
          <Route
            path="registro-usuarios"
            element={
              <RequireRole roles={['ADMINISTRADOR']}>
                <RegistroUsuarios />
              </RequireRole>
            }
          />
        </Route>

        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </>
  )
}
