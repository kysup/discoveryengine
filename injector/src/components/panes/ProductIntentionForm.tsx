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
import {
  createProductIntention,
  getIntentions,
  getProducts,
} from "@/lib/api"
import type { IntentionLite, ProductLite } from "@/types"

export function ProductIntentionForm() {
  const [products, setProducts] = useState<ProductLite[]>([])
  const [intentions, setIntentions] = useState<IntentionLite[]>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [intentionId, setIntentionId] = useState("")
  const [score, setScore] = useState("")
  const [status, setStatus] = useState<StatusState>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Promise.all([getProducts(), getIntentions()])
      .then(([p, i]) => {
        setProducts(p)
        setIntentions(i)
      })
      .catch((e) => setStatus({ kind: "error", text: (e as Error).message }))
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (selectedProducts.length === 0 || !intentionId) {
      setStatus({ kind: "error", text: "Select at least one product and an intention" })
      return
    }
    setBusy(true)
    setStatus({ kind: "loading", text: "Creating product intentions…" })
    try {
      for (const pid of selectedProducts) {
        await createProductIntention(Number(pid), Number(intentionId), Number(score))
      }
      setStatus({ kind: "success", text: "✓ Product intentions created successfully" })
      setSelectedProducts([])
      setIntentionId("")
      setScore("")
    } catch (err) {
      setStatus({ kind: "error", text: (err as Error).message })
    }
    setBusy(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Add Product Intentions</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Products" required>
            <MultiSelect
              options={products.map((p) => ({
                value: String(p.id),
                label: `${p.product_name} (${p.company_name})`,
              }))}
              selected={selectedProducts}
              onChange={setSelectedProducts}
              placeholder="Select products…"
            />
          </Field>
          <Field label="Intention" required>
            <Select value={intentionId} onValueChange={setIntentionId} required>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select intention…" />
              </SelectTrigger>
              <SelectContent>
                {intentions.map((i) => (
                  <SelectItem key={i.id} value={String(i.id)}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Score" required>
            <Input
              type="number"
              step="0.01"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="Enter score"
              required
            />
          </Field>
          <Button type="submit" disabled={busy} className="w-full">
            Add Product Intentions
          </Button>
          <StatusBanner status={status} />
        </form>
      </CardContent>
    </Card>
  )
}
