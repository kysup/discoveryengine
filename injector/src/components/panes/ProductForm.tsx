import { useEffect, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MultiSelect } from "@/components/MultiSelect"
import { Field, StatusBanner, type StatusState } from "@/components/form-bits"
import { createProduct, getIndustries, linkProductIndustry } from "@/lib/api"
import type { IdName } from "@/types"

export function ProductForm() {
  const [industries, setIndustries] = useState<IdName[]>([])
  const [company, setCompany] = useState("")
  const [product, setProduct] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [status, setStatus] = useState<StatusState>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getIndustries()
      .then(setIndustries)
      .catch((e) => setStatus({ kind: "error", text: (e as Error).message }))
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setStatus({ kind: "loading", text: "Creating product…" })
    try {
      const created = await createProduct(company, product)
      for (const id of selected) await linkProductIndustry(created.id, Number(id))
      setStatus({ kind: "success", text: "✓ Product created successfully" })
      setCompany("")
      setProduct("")
      setSelected([])
    } catch (err) {
      setStatus({ kind: "error", text: (err as Error).message })
    }
    setBusy(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Add New Product</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Company Name" required>
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Enter company name"
              required
            />
          </Field>
          <Field label="Product Name" required>
            <Input
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="Enter product name"
              required
            />
          </Field>
          <Field label="Industries">
            <MultiSelect
              options={industries.map((i) => ({ value: String(i.id), label: i.name }))}
              selected={selected}
              onChange={setSelected}
              placeholder="Select industries…"
            />
          </Field>
          <Button type="submit" disabled={busy} className="w-full">
            Add Product
          </Button>
          <StatusBanner status={status} />
        </form>
      </CardContent>
    </Card>
  )
}
