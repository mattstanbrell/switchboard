import { cn } from "@/lib/utils"

interface FocusAreaPillProps {
  name: string
  className?: string
}

export function FocusAreaPill({ name, className }: FocusAreaPillProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center px-3 py-1 text-xs rounded-full border border-custom-ui-medium bg-custom-background-secondary text-custom-text-secondary",
        className
      )}
    >
      {name}
    </div>
  )
} 