// src/components/RequireRole.jsx
import { Navigate } from 'react-router-dom'
import { getUserFromToken } from '../utils/auth'

export default function RequireRole({ roles = [], children }) {
  const me = getUserFromToken()
  const ok = me && roles.includes(me.role)
  if (!ok) return <Navigate to="/app" replace />
  return children
}
