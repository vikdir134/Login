// Requiere que authRequired haya puesto req.user = { id, email, role, ... }
export function requireRole(...allowed) {
  return (req, res, next) => {
    const role = req.user?.role
    if (!role) return res.status(401).json({ error: 'No autenticado' })
    if (!allowed.includes(role)) {
      return res.status(403).json({ error: 'No tienes permisos' })
    }
    next()
  }
}
