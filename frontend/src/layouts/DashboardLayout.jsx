// src/layouts/DashboardLayout.jsx
import { Outlet, useNavigate } from "react-router-dom"
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import AppSidebar from "../components/AppSidebar"
import { Button } from "@/components/ui/button"

export default function DashboardLayout() {
  const navigate = useNavigate()
  const onLogout = () => {
    localStorage.removeItem("token")
    navigate("/login")
  }

  return (
    <SidebarProvider>
      {/* Lado izquierdo: el Sidebar shadcn */}
      <AppSidebar onLogout={onLogout} />

      {/* Lado derecho: contenido */}
      <SidebarInset>
        {/* Header superior */}
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <div className="font-medium">Panel</div>
          <div className="ml-auto" />
          {/* Acciones extra en header si las necesitas */}
          {/* <Button variant="secondary" size="sm">Acción</Button> */}
        </header>

        {/* Contenido central */}
        <main className="p-4">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
