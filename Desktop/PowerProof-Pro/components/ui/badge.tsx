import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

/** Pills are the only fully rounded shape in the product. */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        neutral: "bg-muted text-foreground",
        primary: "bg-primary text-primary-foreground",
        brass: "bg-accent-soft text-accent-ink",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning-ink",
        danger: "bg-danger-soft text-danger",
        info: "bg-info-soft text-info",
        outline: "border-border-strong bg-surface text-foreground",
        // shadcn aliases
        default: "bg-primary text-primary-foreground",
        secondary: "bg-muted text-foreground",
        destructive: "bg-danger-soft text-danger",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
)

function Badge({
  className,
  variant = "neutral",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
