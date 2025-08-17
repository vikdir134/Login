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
import DefaultByRole from './components/DefaultByRole' // nuevo (abajo)

export default function App() {
  return (
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
        {/* Inicio: redirige según rol */}
        <Route index element={<DefaultByRole />} />

        {/* JEFE y ADMIN ven Dashboard, Clientes, Pagos */}
        <Route path="clientes" element={
          <RequireRole roles={['JEFE','ADMINISTRADOR']}><Clientes /></RequireRole>
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
