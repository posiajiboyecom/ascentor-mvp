import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Base
        "w-full min-w-0 h-10 px-3 py-2 rounded-lg text-sm outline-none",
        "font-[family-name:'Inter',sans-serif]",
        "bg-[var(--bg-input)] text-[var(--text)]",
        "border border-[var(--border)]",
        "placeholder:text-[var(--text-dim)]",
        "shadow-xs transition-[border-color,box-shadow] duration-200",
        // Focus — brand blue ring
        "focus:border-[#6662FF] focus:ring-[3px] focus:ring-[rgba(102,98,255,0.15)]",
        // File input
        "file:text-[var(--text-muted)] file:border-0 file:bg-transparent file:text-sm file:font-medium",
        // Disabled
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
        // Invalid
        "aria-invalid:border-[var(--error)] aria-invalid:ring-[rgba(239,68,68,0.15)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
