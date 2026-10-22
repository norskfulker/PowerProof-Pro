import * as React from "react"
import { cn } from "@/lib/utils"

/** Same steps as Button and SelectTrigger (sm 36, md 40, lg 48; 44 minimum on touch) */
const HEIGHT = {
  sm: "h-control-sm",
  md: "h-control",
  lg: "h-control-lg text-base",
} as const

function Input({ className, type, size = "md", ...props }: Omit<React.ComponentProps<"input">, "size"> & { size?: keyof typeof HEIGHT }) {
  return (
    <input
      type={type}
      data-slot="input"
      data-size={size}
      className={cn(
        "w-full min-w-0 rounded-control border border-input bg-surface px-3 py-1.5 text-sm text-foreground pointer-coarse:min-h-control-touch pointer-coarse:text-base transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60",
        HEIGHT[size],
        "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "hover:border-foreground/50 focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary",
        "aria-invalid:border-danger aria-invalid:focus-visible:outline-danger",
        className
      )}
      {...props}
    />
  )
}

export { Input }
