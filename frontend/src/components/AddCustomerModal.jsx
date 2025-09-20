// src/components/AddCustomerModal.jsx
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { createCustomer } from "../api/customers"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form"

const schema = z.object({
  RUC: z.string()
    .trim()
    .min(8, "Mínimo 8 dígitos")
    .max(11, "Máximo 11 dígitos"),
  razonSocial: z.string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(60, "Máximo 60 caracteres"),
  email: z.string().trim().email("Correo no válido").max(100, "Máximo 100").optional().or(z.literal("")),
  phone: z.string().trim().regex(/^[0-9+\-\s()]{0,20}$/, "Teléfono no válido").optional().or(z.literal("")),
  address: z.string().trim().max(150, "Máximo 150 caracteres").optional().or(z.literal("")),
  activo: z.boolean().default(true),
})

export default function AddCustomerModal({ open, onClose, onSuccess }) {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      RUC: "",
      razonSocial: "",
      email: "",
      phone: "",
      address: "",
      activo: true,
    },
  })

  // Reset al abrir
  useEffect(() => {
    if (open) form.reset({
      RUC: "",
      razonSocial: "",
      email: "",
      phone: "",
      address: "",
      activo: true,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onSubmit = async (values) => {
    try {
      await createCustomer({
        RUC: values.RUC.trim(),
        razonSocial: values.razonSocial.trim(),
        phone: values.phone?.trim() || null,
        email: values.email?.trim() || null,
        address: values.address?.trim() || null,
        activo: !!values.activo,
      })
      toast.success("Cliente registrado")
      onSuccess?.()
      onClose?.()
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        (err?.response?.status === 409 ? "RUC o Razón social ya registrados" : null) ||
        err?.message ||
        "Error creando cliente"
      toast.error("No se pudo registrar", { description: msg })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
          <DialogDescription>Completa los datos obligatorios para registrar un cliente.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="RUC"
                render={({ field }) => (
                  <FormItem className="md:col-span-1">
                    <FormLabel>RUC *</FormLabel>
                    <FormControl>
                      <Input placeholder="20123456789" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="razonSocial"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Razón social *</FormLabel>
                    <FormControl>
                      <Input placeholder="ACME S.A.C." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="cliente@empresa.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input placeholder="+51 999 999 999" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dirección</FormLabel>
                  <FormControl>
                    <Input placeholder="Av. Siempre Viva 742" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="activo"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(!!v)}
                      id="activo"
                    />
                  </FormControl>
                  <Label htmlFor="activo">Activo</Label>
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Guardando…" : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
