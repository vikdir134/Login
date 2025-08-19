// Requiere que authRequired haya puesto req.user = { id, email, role, ... }
export function requireRole(roles) {
  return (req, res, next) => {
    const role = req.user?.role
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ error: 'No autorizado' })
    }
    next()
  }
}