import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-control font-semibold whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 ease-out active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-danger [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary:
          "border border-border-strong bg-surface text-foreground hover:border-foreground/40 hover:bg-surface-sunken",
        ghost: "text-foreground hover:bg-muted",
        danger: "bg-danger text-danger-foreground hover:bg-danger/90",
        brass: "bg-accent text-accent-foreground hover:bg-accent-strong",
        link: "h-auto px-0 text-primary underline-offset-4 hover:underline",
        // aliases kept so shadcn internals (calendar, pagination) still resolve
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        outline:
          "border border-border-strong bg-surface text-foreground hover:bg-surface-sunken",
        destructive: "bg-danger text-danger-foreground hover:bg-danger/90",
      },
      size: {
        sm: "h-9 px-3 text-sm max-md:min-h-11 has-[>svg]:px-2.5",
        md: "h-11 px-4 text-sm has-[>svg]:px-3.5",
        lg: "h-13 px-6 text-base has-[>svg]:px-5",
        icon: "size-11",
        "icon-sm": "size-9 max-md:size-11",
        // aliases for shadcn internals
        default: "h-11 px-4 text-sm",
        xs: "h-7 px-2 text-xs",
        "icon-xs": "size-7",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

function Button({
  className,
  variant = "primary",
  size = "md",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
