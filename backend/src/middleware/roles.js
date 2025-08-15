// src/middleware/roles.js
export const requireRole = (...rolesPermitidos) => (req, res, next) => {
  const role = req.user?.role;
  if (!role) return res.status(401).json({ error: 'No autenticado' });
  if (!rolesPermitidos.includes(role)) {
    return res.status(403).json({ error: 'Prohibido: rol insuficiente' });
  }
  next();
};
