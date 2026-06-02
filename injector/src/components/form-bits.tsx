import type { ReactNode } from "react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="grid gap-2">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  )
}

export type StatusState = { kind: "success" | "error" | "loading"; text: string } | null

export function StatusBanner({ status }: { status: StatusState }) {
  if (!status) return null
  const styles = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    error: "border-red-200 bg-red-50 text-red-700",
    loading: "border-blue-200 bg-blue-50 text-blue-700",
  }[status.kind]
  return (
    <div className={cn("rounded-md border px-3 py-2 text-sm", styles)}>{status.text}</div>
  )
}
