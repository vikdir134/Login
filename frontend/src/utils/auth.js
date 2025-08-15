// src/utils/auth.js
export function getUserFromToken() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const [, payload] = token.split('.');
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const data = JSON.parse(json); // { id, email, role, name, iat, exp }
    return data;
  } catch {
    return null;
  }
}

export function getInitials(text = '') {
  const s = String(text || '').trim();
  if (!s) return '?';
  const display = s.includes('@') ? s.split('@')[0] : s;
  const parts = display.split(/[.\s_-]+/).filter(Boolean);
  const first = parts[0]?.[0] || '';
  const second = parts[1]?.[0] || '';
  return (first + second).toUpperCase();
}

export function hasRole(user, ...roles) {
  if (!user?.role) return false;
  return roles.includes(user.role);
}

export function getDisplayName(user) {
  // Preferimos name del token; si no viene, caemos al email
  return user?.name?.trim() || user?.email || 'usuario';
}
