import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Sun, Moon, Eye, EyeOff } from "lucide-react"

import api from "../api/axios"
import { useTheme } from "../theme/ThemeProvider"

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form"

const schema = z.object({
  email: z.string().email("Ingresa un email válido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
})

export default function Login() {
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  })

  const onSubmit = async (values) => {
    try {
      const { data } = await api.post("/api/auth/login", values)
      localStorage.setItem("token", data.token)

      toast.success("Sesión iniciada", { description: "Bienvenido 👋" })
      navigate("/")
    } catch (err) {
      const msg = err?.response?.data?.error || "Error de conexión"
      toast.error("No se pudo iniciar sesión", { description: msg })
    }
  }

  return (
    <div className="min-h-screen w-full grid place-items-center px-4">
      <Card className="w-full max-w-[440px]">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Iniciar sesión</CardTitle>
            <CardDescription>Accede a tu cuenta para continuar</CardDescription>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label="Cambiar tema"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </Button>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="tucorreo@dominio.com"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Contraseña</Label>
                      {/* Link "¿Olvidaste tu contraseña?" si lo necesitas */}
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2"
                        onClick={() => setShowPassword(v => !v)}
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Verificando..." : "Entrar"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
