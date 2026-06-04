import type { ReactNode } from "react"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"

type Props = {
  active: boolean
  text: string
  side?: "top" | "right" | "bottom" | "left"
  children: ReactNode
}

/**
 * First-load coachmark. When `active`, anchors a small callout to its child.
 * When inactive it renders the child untouched (no lingering popover behavior).
 */
export function Hint({ active, text, side = "right", children }: Props) {
  if (!active) return <>{children}</>

  return (
    <Popover open>
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      <PopoverContent
        side={side}
        align="center"
        sideOffset={12}
        // don't steal focus from the form when the callout appears
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-56 bg-foreground p-3 text-sm text-background shadow-lg ring-0"
      >
        {text}
      </PopoverContent>
    </Popover>
  )
}
