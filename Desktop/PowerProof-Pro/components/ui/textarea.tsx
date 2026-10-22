import * as React from "react"
import { cn } from "@/lib/utils"

/** How tall it starts (it grows with its text): a couple of lines, a paragraph, or a long page */
const MIN = {
  sm: "min-h-20",
  md: "min-h-28",
  lg: "min-h-48",
} as const

/** Same border, padding, type and focus as Input; only the height grows with the text */
function Textarea({ className, size = "md", ...props }: React.ComponentProps<"textarea"> & { size?: keyof typeof MIN }) {
  return (
    <textarea
      data-slot="textarea"
      data-size={size}
      className={cn(
        "flex field-sizing-content w-full rounded-control border border-input bg-surface px-3 py-2 text-sm leading-relaxed text-foreground pointer-coarse:text-base transition-[border-color] duration-150 placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60",
        MIN[size],
        "hover:border-foreground/50 focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary",
        "aria-invalid:border-danger aria-invalid:focus-visible:outline-danger",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
