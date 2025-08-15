// utils/auth.js

// Obtiene datos del token guardado en localStorage
export function getUserFromToken() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const [, payload] = token.split(".");
    const decoded = JSON.parse(atob(payload));
    return decoded; // { id, email, ... }
  } catch (e) {
    console.error("Token inválido", e);
    return null;
  }
}

// Saca iniciales del email o nombre
export function getInitials(nameOrEmail) {
  if (!nameOrEmail) return "";
  const name = nameOrEmail.split("@")[0]; // antes del @
  const parts = name.split(/[\s._-]+/);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("");
}
