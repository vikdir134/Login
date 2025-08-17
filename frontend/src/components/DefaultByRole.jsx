// src/components/DefaultByRole.jsx
import { Navigate } from 'react-router-dom'
import { getUserFromToken } from '../utils/auth'

export default function DefaultByRole() {
  const me = getUserFromToken()
  const role = me?.role

  if (role === 'ALMACENERO')    return <Navigate to="/app/almacen" replace />
  if (role === 'PRODUCCION')    return <Navigate to="/app/pedidos" replace /> // o "/app/almacen" si prefieres
  if (role === 'JEFE')          return <Navigate to="/app" replace />         // Dashboard
  if (role === 'ADMINISTRADOR') return <Navigate to="/app" replace />

  return <Navigate to="/login" replace />
}
