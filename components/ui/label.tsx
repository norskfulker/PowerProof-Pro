"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Label as LabelPrimitive } from "radix-ui"

/** The look of a field label, for spans and legends that label a group instead of one input */
const fieldLabel = "text-[0.8125rem] font-medium text-foreground/80"

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        `flex items-center gap-2 leading-none select-none ${fieldLabel} group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50`,
        className
      )}
      {...props}
    />
  )
}

export { Label, fieldLabel }
