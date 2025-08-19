import { NavLink } from 'react-router-dom'
import { useTheme } from '../theme/ThemeProvider'
import { getUserFromToken, getInitials, getDisplayName } from '../utils/auth'

// Ítems y roles permitidos
const NAV_ITEMS = [
  { to: '/app', label: 'Dashboard', icon: '🏠', end: true, roles: ['JEFE', 'ADMINISTRADOR'] },
  { to: '/app/clientes', label: 'Clientes', icon: '👥', roles: ['JEFE', 'ADMINISTRADOR'] },
  { to: '/app/pedidos', label: 'Pedidos', icon: '🧾', roles: ['PRODUCCION', 'JEFE', 'ADMINISTRADOR'] },
  { to: '/app/almacen', label: 'Almacén', icon: '📦', roles: ['ALMACENERO', 'PRODUCCION', 'JEFE', 'ADMINISTRADOR'] },
  { to: '/app/producto-terminado', label: 'Producto Terminado', icon: '🧱', roles: ['ALMACENERO', 'PRODUCCION', 'JEFE', 'ADMINISTRADOR'] },
  { to: '/app/entregas', label: 'Entregas', icon: '🚚', roles: ['ALMACENERO', 'PRODUCCION', 'JEFE', 'ADMINISTRADOR'] },
  { to: '/app/pagos', label: 'Pagos', icon: '💳', roles: ['JEFE', 'ADMINISTRADOR'] },
  { to: '/app/compras', label: 'Compras', icon: '🧾', roles: ['ALMACENERO', 'JEFE', 'ADMINISTRADOR'] },
  { to: '/app/registro-usuarios', label: 'Registro de usuarios', icon: '👤➕', roles: ['ADMINISTRADOR'] },
]

export default function Sidebar({ collapsed = false, onLogout }) {
  const { theme, toggle } = useTheme()
  const user = getUserFromToken()
  const role = user?.role

  const visibleItems = NAV_ITEMS.filter(i => !role || i.roles.includes(role))

  return (
    // NO usamos estilos inline para ancho/alto; lo maneja tu CSS (.sidebar + .app-shell)
    <div className="sidebar__inner" style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      {/* Marca */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--card)', display: 'grid', placeItems: 'center', fontWeight: 700 }}>L</div>
        <strong className="hide-when-collapsed">Mi ERP</strong>
      </div>

      {/* Usuario */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--card)', display: 'grid', placeItems: 'center', fontWeight: 700 }}>
          {getInitials(getDisplayName(user))}
        </div>
        <div className="hide-when-collapsed" style={{ display: 'grid' }}>
          <strong style={{ fontSize: 14 }}>{getDisplayName(user)}</strong>
          <span className="muted" style={{ fontSize: 11, marginTop: 2, border: '1px solid var(--card)', borderRadius: 999, padding: '2px 8px' }}>
            {role || '—'}
          </span>
        </div>
      </div>

      {/* Navegación visible según rol */}
      <nav style={{ display: 'grid', gap: 6 }}>
        {visibleItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => 'nav-item' + (isActive ? ' nav-item--active' : '')}
            title={item.label}
          >
            <span style={{ marginRight: collapsed ? 0 : 8 }}>{item.icon}</span>
            <span className="hide-when-collapsed">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      {/* Acciones */}
      <div style={{ display: 'grid', gap: 8 }}>
        <button type="button" className="btn-secondary" onClick={toggle} title="Cambiar tema">
          {theme === 'dark' ? '☀️ Claro' : '🌙 Oscuro'}
        </button>
        <button type="button" className="btn" onClick={onLogout} title="Cerrar sesión" style={{ width: '100%' }}>
          ⎋ <span className="hide-when-collapsed">Salir</span>
        </button>
      </div>
    </div>
  )
}
