// src/components/RequireRole.jsx
import { Navigate } from 'react-router-dom'
import { getUserFromToken } from '../utils/auth'

export default function RequireRole({ roles, children }) {
  const me = getUserFromToken()
  if (!me?.role) return <Navigate to="/login" replace />
  if (!roles.includes(me.role)) return <Navigate to="/app" replace />
  return children
}
