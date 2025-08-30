// src/components/Sidebar.jsx
import { NavLink } from 'react-router-dom'
import { useTheme } from '../theme/ThemeProvider'
import { getUserFromToken, getInitials, getDisplayName } from '../utils/auth'

const NAV_ITEMS = [
  { to: '/app',              label: 'Dashboard',           icon: '🏠', roles: ['JEFE','ADMINISTRADOR'], end: true },
  { to: '/app/clientes',     label: 'Clientes',            icon: '👥', roles: ['JEFE','ADMINISTRADOR'] },
  { to: '/app/pedidos',      label: 'Pedidos',             icon: '🧾', roles: ['PRODUCCION','JEFE','ADMINISTRADOR'] },
  { to: '/app/almacen',      label: 'Almacén',             icon: '📦', roles: ['ALMACENERO','PRODUCCION','JEFE','ADMINISTRADOR'] },
  { to: '/app/entregas',     label: 'Entregas',            icon: '🚚', roles: ['ALMACENERO','PRODUCCION','JEFE','ADMINISTRADOR'] },
  { to: '/app/cxc',          label: 'Cuentas x cobrar',    icon: '📒', roles: ['JEFE','ADMINISTRADOR'] },   // ← NUEVO
  { to: '/app/pagos',        label: 'Pagos',               icon: '💳', roles: ['JEFE','ADMINISTRADOR'] },
  { to: '/app/compras',      label: 'Compras',             icon: '🧾', roles: ['ALMACENERO','JEFE','ADMINISTRADOR'] },
  { to: '/app/registro-usuarios', label: 'Registro de usuarios', icon: '👤➕', roles: ['ADMINISTRADOR'] },
]

export default function Sidebar({ collapsed = false, onLogout }) {
  const { theme, toggle } = useTheme()
  const user = getUserFromToken()
  const role = user?.role
  const w = collapsed ? 76 : 260
  const hide = collapsed ? { display: 'none' } : {}

  const visibleItems = NAV_ITEMS.filter(i => !role || i.roles.includes(role))

  return (
    <aside style={{ width: w, minHeight: '100vh', borderRight: '1px solid var(--card)', padding: 16, display: 'flex', flexDirection: 'column', gap: 16, transition: 'width .2s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--card)', display: 'grid', placeItems: 'center', fontWeight: 700 }}>L</div>
        <strong style={hide}>Mi ERP</strong>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--card)', display: 'grid', placeItems: 'center', fontWeight: 700 }}>
          {getInitials(getDisplayName(user))}
        </div>
        <div style={{ display: 'grid', ...hide }}>
          <strong style={{ fontSize: 14 }}>{getDisplayName(user)}</strong>
          <span className="muted" style={{ fontSize: 11, marginTop: 2, border: '1px solid var(--card)', borderRadius: 999, padding: '2px 8px' }}>
            {role || '—'}
          </span>
        </div>
      </div>

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
            {!collapsed && item.label}
          </NavLink>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'grid', gap: 8 }}>
        <button type="button" className="btn-secondary" onClick={toggle} title="Cambiar tema">
          {theme === 'dark' ? '☀️' : '🌙'} {!collapsed && (theme === 'dark' ? 'Claro' : 'Oscuro')}
        </button>
        <button type="button" className="btn" onClick={onLogout} title="Cerrar sesión" style={{ width: '100%' }}>
          ⎋ {!collapsed && 'Salir'}
        </button>
      </div>
    </aside>
  )
}
