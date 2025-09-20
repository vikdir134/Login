// src/components/Sidebar.jsx
import { NavLink } from "react-router-dom"
import { useTheme } from "../theme/ThemeProvider"
import { getUserFromToken, getInitials, getDisplayName } from "../utils/auth"
import {
  Sidebar as ShSidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import {
  Home,
  Users,
  ShoppingCart,
  Boxes,
  Package,
  Truck,
  CreditCard,
  UserPlus,
  LogOut,
  Sun,
  Moon,
  NotebookText
} from "lucide-react"

const NAV_ITEMS = [
  { to: "/app", label: "Dashboard", icon: Home, roles: ["JEFE","ADMINISTRADOR"], end: true },
  { to: "/app/clientes", label: "Clientes", icon: Users, roles: ["JEFE","ADMINISTRADOR"] },
  { to: "/app/pedidos", label: "Pedidos", icon: ShoppingCart, roles: ["PRODUCCION","JEFE","ADMINISTRADOR"] },
  { to: "/app/almacen", label: "Almacén", icon: Boxes, roles: ["ALMACENERO","PRODUCCION","JEFE","ADMINISTRADOR"] },
  { to: "/app/entregas", label: "Entregas", icon: Truck, roles: ["ALMACENERO","PRODUCCION","JEFE","ADMINISTRADOR"] },
  { to: "/app/cxc", label: "Cuentas x cobrar", icon: NotebookText, roles: ["JEFE","ADMINISTRADOR"] },
  { to: "/app/pagos", label: "Pagos", icon: CreditCard, roles: ["JEFE","ADMINISTRADOR"] },
  { to: "/app/compras", label: "Compras", icon: ShoppingCart, roles: ["ALMACENERO","JEFE","ADMINISTRADOR"] },
  { to: "/app/registro-usuarios", label: "Registro de usuarios", icon: UserPlus, roles: ["ADMINISTRADOR"] },
]

export default function Sidebar({ onLogout }) {
  const { theme, toggle } = useTheme()
  const user = getUserFromToken()
  const role = user?.role

  const visibleItems = NAV_ITEMS.filter(i => !role || i.roles.includes(role))

  return (
    <TooltipProvider delayDuration={300}>
      {/* colapsable="icon" permite modo compacto con solo iconos */}
      <ShSidebar collapsible="icon">
        <SidebarHeader>
          <div className="px-2 py-1 flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-muted grid place-items-center font-bold">L</div>
            <span className="font-semibold">Mi ERP</span>
          </div>
          <div className="px-2 py-2 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-muted grid place-items-center font-bold">
              {getInitials(getDisplayName(user))}
            </div>
            <div className="leading-tight">
              <div className="text-sm font-medium">{getDisplayName(user)}</div>
              <div className="text-[11px] text-muted-foreground border rounded-full px-2 py-[2px] inline-block mt-[2px]">
                {role || "—"}
              </div>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Menú</SidebarGroupLabel>
            <SidebarMenu>
              {visibleItems.map(({ to, label, icon: Icon, end }) => (
                <SidebarMenuItem key={to}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={to}
                          end={end}
                          className={({ isActive }) =>
                            [
                              "flex items-center gap-2",
                              isActive ? "bg-accent text-accent-foreground" : ""
                            ].join(" ")
                          }
                          title={label}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right">{label}</TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <div className="px-2 py-2 grid gap-2">
            <Button variant="secondary" onClick={toggle} className="justify-start">
              {theme === "dark" ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
              <span>Cambiar tema</span>
            </Button>
            <Button onClick={onLogout} className="justify-start">
              <LogOut className="h-4 w-4 mr-2" />
              <span>Salir</span>
            </Button>
          </div>
        </SidebarFooter>
      </ShSidebar>
    </TooltipProvider>
  )
}
