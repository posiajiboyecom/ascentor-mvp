import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold",
    "transition-all duration-200 outline-none cursor-pointer",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0",
    "focus-visible:ring-2 focus-visible:ring-[#6662FF]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent",
    "font-[family-name:var(--font-body,'Inter',sans-serif)]",
  ].join(" "),
  {
    variants: {
      variant: {
        // Primary — Ascentor brand blue
        default:
          "bg-[#6662FF] text-white shadow-[0_4px_14px_rgba(102,98,255,0.35)] hover:bg-[#4D4ACC] hover:shadow-[0_4px_20px_rgba(102,98,255,0.45)] active:scale-[0.98]",

        // Soft blue fill
        secondary:
          "bg-[rgba(102,98,255,0.1)] text-[#A6A2FF] border border-[rgba(102,98,255,0.2)] hover:bg-[rgba(102,98,255,0.16)] hover:border-[rgba(102,98,255,0.35)] active:scale-[0.98]",

        // Outlined
        outline:
          "border border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:border-[#6662FF] hover:text-[var(--accent)] hover:bg-[rgba(102,98,255,0.06)] active:scale-[0.98]",

        // Ghost — no border
        ghost:
          "bg-transparent text-[var(--text-muted)] hover:bg-[rgba(102,98,255,0.08)] hover:text-[var(--text)] active:scale-[0.98]",

        // Destructive
        destructive:
          "bg-[var(--error)] text-white shadow-[0_4px_14px_rgba(239,68,68,0.3)] hover:opacity-90 active:scale-[0.98]",

        // Lime accent — secondary brand color, use for special CTAs
        lime:
          "bg-[rgba(207,255,94,0.12)] text-[#CFFF5E] border border-[rgba(207,255,94,0.25)] hover:bg-[rgba(207,255,94,0.2)] active:scale-[0.98]",

        // Link style
        link: "text-[var(--accent)] underline-offset-4 hover:underline bg-transparent p-0 h-auto",
      },
      size: {
        default: "h-9 px-4 py-2",
        xs:      "h-6 px-2 text-xs rounded-md gap-1",
        sm:      "h-8 px-3 text-xs rounded-md",
        lg:      "h-11 px-6 text-base rounded-xl",
        xl:      "h-12 px-8 text-base rounded-xl",
        icon:    "size-9 rounded-lg",
        "icon-xs": "size-6 rounded-md",
        "icon-sm": "size-8 rounded-md",
        "icon-lg": "size-11 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
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
