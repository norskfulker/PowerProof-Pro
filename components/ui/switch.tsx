"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Switch as SwitchPrimitive } from "radix-ui"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  const [uncontrolledChecked, setUncontrolledChecked] = React.useState(props.defaultChecked ?? false)
  const checked = props.checked ?? uncontrolledChecked

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "relative inline-grid shrink-0 grid-cols-2 place-items-center rounded-full border border-transparent bg-muted p-0.5 transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-8 data-[size=default]:w-16 data-[size=sm]:h-7 data-[size=sm]:w-14 data-[state=checked]:bg-primary motion-reduce:transition-none",
        className
      )}
      {...props}
      checked={checked}
      onCheckedChange={(next) => {
        setUncontrolledChecked(next)
        props.onCheckedChange?.(next)
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0.5 rounded-full bg-surface shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{
          left: "0.125rem",
          width: size === "default" ? "1.5rem" : "1.25rem",
          transform: checked
            ? `translateX(${size === "default" ? "1.75rem" : "1.5rem"})`
            : "translateX(0)",
        }}
      />
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none sr-only"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
