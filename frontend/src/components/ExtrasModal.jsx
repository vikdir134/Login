import { useEffect, useState } from "react"
import { createColor, createMaterial } from "../api/extras"

/* shadcn */
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"

export default function ExtrasModal({ open, onClose }) {
  const [tab, setTab] = useState("COLOR")
  const [name, setName] = useState("")
  const [msg, setMsg] = useState("")
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return
    setTab("COLOR"); setName(""); setMsg(""); setSending(false)
  }, [open])

  const submit = async (e) => {
    e?.preventDefault?.()
    setMsg("")
    setSending(true)
    try {
      if (!name.trim()) throw new Error("Nombre requerido")
      if (tab === "COLOR") {
        await createColor(name.trim())
        setMsg("✅ Color creado")
      } else {
        await createMaterial(name.trim())
        setMsg("✅ Material creado")
      }
      setName("")
    } catch (err) {
      setMsg(err?.response?.data?.error || err.message || "Error")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Extras</DialogTitle>
          <DialogDescription className="sr-only">
            Crear colores o materiales auxiliares.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="COLOR">Agregar Color</TabsTrigger>
            <TabsTrigger value="MATERIAL">Agregar Material</TabsTrigger>
          </TabsList>

          <TabsContent value="COLOR" className="mt-3" />
          <TabsContent value="MATERIAL" className="mt-3" />
        </Tabs>

        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          {!!msg && (
            <div className={/✅/.test(msg) ? "text-muted-foreground" : "text-destructive"}>{msg}</div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={onClose}>Cerrar</Button>
            <Button type="submit" disabled={sending}>{sending ? "Guardando…" : "Guardar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
