import { CalendarIcon } from "lucide-react"
import { addHours, endOfDay, format } from "date-fns"
import { es } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils" // si no tienes cn, reemplaza cn(...) por la string base

/**
 * props:
 * - value: { from?: Date, to?: Date }
 * - onChange: (range: { from?: Date, to?: Date }) => void
 * - fromYear/toYear: límites de selección
 */
export default function DateRangePicker({
  value,
  onChange,
  fromYear = 2020,
  toYear = new Date().getFullYear() + 1,
  className,
}) {
  const label = value?.from && value?.to
    ? `${format(value.from, "d MMM yyyy", { locale: es })} – ${format(value.to, "d MMM yyyy", { locale: es })}`
    : "Selecciona rango"

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-full justify-start text-left font-normal", className)}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Calendar
          mode="range"
          selected={value}
          onSelect={(r) => {
            // Normalizamos al final del día el TO (para que el filtro sea inclusivo)
            const next = r?.to ? { ...r, to: endOfDay(r.to) } : r
            onChange?.(next)
          }}
          numberOfMonths={2}
          captionLayout="dropdown"  // 👈 dropdowns de Mes/Año
          fromYear={fromYear}
          toYear={toYear}
          locale={es}
          ISOWeek
        />
      </PopoverContent>
    </Popover>
  )
}
