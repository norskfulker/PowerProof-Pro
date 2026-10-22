"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useSyncExternalStore } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { useTheme } from "@/components/theme/theme-toggle"

const PHONE = "(max-width: 767px)"
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(PHONE)
  m.addEventListener("change", cb)
  return () => m.removeEventListener("change", cb)
}

/** On phones toasts sit at the top, clear of the tab bar and the save bar at the bottom. */
const Toaster = ({ position, ...props }: ToasterProps) => {
  const phone = useSyncExternalStore(subscribe, () => window.matchMedia(PHONE).matches, () => false)
  const { mode } = useTheme()
  return (
    <Sonner
      theme={mode}
      position={phone ? "top-center" : position}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-success" />,
        info: <InfoIcon className="size-4 text-info" />,
        warning: <TriangleAlertIcon className="size-4 text-warning" />,
        error: <OctagonXIcon className="size-4 text-danger" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: "!font-sans !shadow-pop",
          title: "!font-semibold",
          description: "![color:var(--toast-muted)]",
        },
      }}
      style={
        {
          "--normal-bg": "var(--toast-bg)",
          "--normal-text": "var(--toast-fg)",
          "--normal-border": "var(--toast-border)",
          "--border-radius": "12px",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
