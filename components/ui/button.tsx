import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

/*
 * Buttons move: a 1px lift and a stronger shadow on hover, a press on click, a light sweep across
 * filled buttons, and a trailing icon (an arrow) nudges forward. All of it switches off under
 * prefers-reduced-motion (app/globals.css).
 */
const FILLED_SHEEN =
  "bg-[image:linear-gradient(180deg,rgb(255_255_255/0.2),rgb(255_255_255/0)_55%)] relative isolate overflow-hidden before:pointer-events-none before:absolute before:inset-y-0 before:-left-full before:w-full before:-skew-x-12 before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent before:transition-transform before:duration-700 before:ease-out hover:before:translate-x-[200%]"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-danger [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:transition-transform [&_svg]:duration-200 [&_svg:not([class*='size-'])]:size-4 hover:[&>svg:last-child:not(:first-child)]:translate-x-0.5",
  {
    variants: {
      variant: {
        primary: `bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover hover:shadow-lift ${FILLED_SHEEN}`,
        secondary:
          "border border-border-strong bg-surface text-foreground shadow-xs hover:border-foreground/25 hover:shadow-lift",
        ghost: "text-foreground hover:translate-y-0 hover:bg-muted",
        danger: `bg-danger text-danger-foreground shadow-xs hover:bg-danger/90 hover:shadow-lift ${FILLED_SHEEN}`,
        brass: `bg-accent text-accent-foreground shadow-xs hover:bg-accent-strong hover:shadow-lift ${FILLED_SHEEN}`,
        link: "h-auto px-0 text-primary underline-offset-4 hover:translate-y-0 hover:underline active:scale-100",
        // aliases kept so shadcn internals (calendar, pagination) still resolve
        default: `bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover hover:shadow-lift ${FILLED_SHEEN}`,
        outline:
          "border border-border-strong bg-surface text-foreground shadow-xs hover:shadow-lift",
        destructive: `bg-danger text-danger-foreground shadow-xs hover:bg-danger/90 ${FILLED_SHEEN}`,
      },
      size: {
        sm: "h-9 px-3 text-sm pointer-coarse:min-h-11 pointer-coarse:min-w-11 has-[>svg]:px-2.5",
        md: "h-11 px-4 text-sm has-[>svg]:px-3.5",
        lg: "h-13 px-6 text-base has-[>svg]:px-5",
        icon: "size-11",
        "icon-sm": "size-9 pointer-coarse:size-11",
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
