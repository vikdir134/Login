import { useMemo, useState } from "react"
import { ChevronsUpDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"

/* shadcn/ui */
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"

/**
 * Reusable SearchCombobox
 *
 * Props:
 * - value: string | number | undefined (controlled)
 * - onChange: (newValue: string | number | undefined) => void
 * - options: any[]  (array de objetos)
 * - getValue: (opt) => string  (ID stringificable, no puede ser "")
 * - getLabel: (opt) => string  (texto a mostrar)
 * - placeholder?: string
 * - emptyMessage?: string
 * - disabled?: boolean
 * - className?: string
 *
 * Uso típico:
 *  <SearchCombobox
 *    value={materialId}
 *    onChange={setMaterialId}
 *    options={materials}
 *    getValue={(o)=> String(o.id)}
 *    getLabel={(o)=> o.name}
 *    placeholder="Buscar material…"
 *  />
 */
export default function SearchCombobox({
  value,
  onChange,
  options,
  getValue,
  getLabel,
  placeholder = "Buscar…",
  emptyMessage = "Sin resultados",
  disabled = false,
  className,
}) {
  const [open, setOpen] = useState(false)

  const items = useMemo(() => {
    // Normaliza y filtra out items con value vacío (Radix Select/Command no soporta "")
    return (Array.isArray(options) ? options : [])
      .map((o) => {
        const v = String(getValue(o) ?? "")
        const l = String(getLabel(o) ?? "")
        return v ? { raw: o, value: v, label: l } : null
      })
      .filter(Boolean)
  }, [options, getValue, getLabel])

  const selected = useMemo(() => {
    if (value === undefined || value === null) return undefined
    const vv = String(value)
    return items.find((i) => i.value === vv)
  }, [items, value])

  const handleSelect = (v) => {
    // Radix CommandItem onSelect te da el "value" string
    // Si el value actual es el mismo, permite "des-seleccionar" (opcional):
    if (selected?.value === v) {
      onChange?.(undefined)
    } else {
      // devolvemos tal cual string; si necesitas number, convierte arriba donde lo uses.
      onChange?.(v)
    }
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          {selected?.label || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {items.map((it) => {
                const active = selected?.value === it.value
                return (
                  <CommandItem
                    key={it.value}
                    value={it.label}
                    onSelect={() => handleSelect(it.value)}
                  >
                    <Check className={cn("mr-2 h-4 w-4", active ? "opacity-100" : "opacity-0")} />
                    {it.label}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
