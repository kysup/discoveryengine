import { useEffect, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MultiSelect } from "@/components/MultiSelect"
import { Field, StatusBanner, type StatusState } from "@/components/form-bits"
import { createIntention, getPillars, linkIntentionPillar } from "@/lib/api"
import type { IdName } from "@/types"

export function IntentionForm() {
  const [pillars, setPillars] = useState<IdName[]>([])
  const [label, setLabel] = useState("")
  const [type, setType] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [status, setStatus] = useState<StatusState>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getPillars()
      .then(setPillars)
      .catch((e) => setStatus({ kind: "error", text: (e as Error).message }))
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!type) {
      setStatus({ kind: "error", text: "Please select a type for the intention" })
      return
    }
    setBusy(true)
    setStatus({ kind: "loading", text: "Creating intention…" })
    try {
      const created = await createIntention(label, type)
      for (const id of selected) await linkIntentionPillar(created.id, Number(id))
      setStatus({ kind: "success", text: "✓ Intention created successfully" })
      setLabel("")
      setType("")
      setSelected([])
    } catch (err) {
      setStatus({ kind: "error", text: (err as Error).message })
    }
    setBusy(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Add New Intention</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Label" required>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Enter intention label"
              required
            />
          </Field>
          <Field label="Type" required>
            <Select value={type} onValueChange={setType} required>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pain_point">Pain Point</SelectItem>
                <SelectItem value="initiative">Initiative</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Pillars">
            <MultiSelect
              options={pillars.map((p) => ({ value: String(p.id), label: p.name }))}
              selected={selected}
              onChange={setSelected}
              placeholder="Select pillars…"
            />
          </Field>
          <Button type="submit" disabled={busy} className="w-full">
            Add Intention
          </Button>
          <StatusBanner status={status} />
        </form>
      </CardContent>
    </Card>
  )
}
