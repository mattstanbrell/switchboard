import * as React from "react"
import { cn } from "@/lib/utils"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"

export type Option = {
  value: string
  label: string
}

interface MultiSelectProps {
  options: Option[]
  selected: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  className?: string
}

export function MultiSelect({ 
  options, 
  selected = [], 
  onChange,
  placeholder = "Select items...",
  className
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const handleToggle = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter(v => v !== value)
      : [...selected, value]
    onChange(newSelected)
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={isOpen}
        className={cn("w-full justify-between", className)}
        onClick={() => setIsOpen(!isOpen)}
      >
        {selected.length === 0
          ? placeholder
          : `${selected.length} selected`}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {options.map((option) => (
            <div
              key={option.value}
              className={cn(
                "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                selected.includes(option.value) && "bg-accent text-accent-foreground"
              )}
              onClick={() => handleToggle(option.value)}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  selected.includes(option.value) ? "opacity-100" : "opacity-0"
                )}
              />
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 