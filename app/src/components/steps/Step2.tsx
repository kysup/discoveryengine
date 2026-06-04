import { useEffect, useMemo, useRef, useState } from "react"
import Fuse from "fuse.js"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  getIntentionsWithScores,
  submitLead,
  updateIntentionScores,
} from "@/lib/api"
import type { Intention, Lead, Recommendation } from "@/types"

type Props = {
  lead: Lead
  onComplete: (recommendations: Recommendation[]) => void
}

const selectablePill =
  "cursor-pointer rounded-full border border-input bg-background px-3 py-1.5 text-sm transition-colors hover:border-primary hover:bg-primary/5"

export function Step2({ lead, onComplete }: Props) {
  const [top, setTop] = useState<Intention[]>([])
  const [all, setAll] = useState<Intention[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const searchBlockRef = useRef<HTMLDivElement>(null)
  const topBlockRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getIntentionsWithScores(lead.pillarId, lead.industryId)
      .then((d) => {
        setTop(d.topIntentions)
        setAll(d.allIntentions)
      })
      .catch((e) => setError((e as Error).message))
  }, [lead.pillarId, lead.industryId])

  const fuse = useMemo(() => new Fuse(all, { keys: ["label"], threshold: 0.3 }), [all])
  const topIds = useMemo(() => new Set(top.map((t) => t.id)), [top])
  const byId = useMemo(
    () => new Map(all.map((i) => [i.id, i] as [number, Intention])),
    [all],
  )

  const results = useMemo(() => {
    const q = query.trim()
    if (!q) return []
    return fuse
      .search(q)
      .map((r) => r.item)
      .filter((i) => !selectedIds.has(i.id) && !topIds.has(i.id))
  }, [query, fuse, selectedIds, topIds])

  const visibleTop = top.filter((t) => !selectedIds.has(t.id))
  const selected = [...selectedIds]
    .map((id) => byId.get(id))
    .filter((i): i is Intention => Boolean(i))

  const add = (id: number) => setSelectedIds((p) => new Set(p).add(id))
  const remove = (id: number) =>
    setSelectedIds((p) => {
      const n = new Set(p)
      n.delete(id)
      return n
    })

  function flashEmpty() {
    for (const el of [searchBlockRef.current, topBlockRef.current]) {
      if (!el) continue
      el.classList.remove("flash-empty")
      void el.offsetWidth // restart the animation if it's mid-flash
      el.classList.add("flash-empty")
    }
  }

  async function handleSubmit() {
    if (selectedIds.size === 0) {
      flashEmpty()
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const ids = [...selectedIds]
      const res = await submitLead(lead, ids)
      // Increment engagement AFTER recommendations are computed, so a lead's own
      // picks never inflate their own results.
      void updateIntentionScores(ids).catch(() => {})
      onComplete(res.recommendations)
    } catch (e) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-5xl">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold">Company Initiatives or Pain Points</h1>
        <p className="text-muted-foreground">Select the initiatives that matter to you.</p>
      </div>

      {error && <p className="mb-4 text-center text-sm text-destructive">{error}</p>}

      <div className="grid gap-5 md:grid-cols-2">
        {/* Pane 1: discover */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Find Initiatives</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div ref={searchBlockRef} className="relative rounded-lg border border-border p-4">
              <label className="mb-2 block text-sm font-medium">Search</label>
              <Input
                placeholder="Search initiatives..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="mb-3"
              />
              <div className="flex max-h-56 flex-col gap-2 overflow-y-auto rounded-md border border-border bg-muted/40 p-3">
                {results.length === 0 ? (
                  <p className="m-auto py-4 text-sm text-muted-foreground">No results</p>
                ) : (
                  results.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => add(i.id)}
                      className={`${selectablePill} w-full text-left`}
                    >
                      {i.label}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div ref={topBlockRef} className="relative rounded-lg border border-border p-4">
              <label className="mb-2 block text-sm font-medium">
                Top Initiatives for {lead.pillarName || "your department"}
              </label>
              <div className="flex min-h-[60px] flex-wrap items-start gap-2 rounded-md border border-border bg-muted/40 p-3">
                {visibleTop.length === 0 ? (
                  <p className="m-auto py-2 text-sm text-muted-foreground">No initiatives</p>
                ) : (
                  visibleTop.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => add(i.id)}
                      className={selectablePill}
                    >
                      {i.label}
                    </button>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pane 2: selections */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Selections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex min-h-[200px] flex-wrap items-start gap-2 rounded-md border border-border bg-muted/40 p-3">
              {selected.length === 0 ? (
                <p className="m-auto text-sm text-muted-foreground">No selections</p>
              ) : (
                selected.map((i) => (
                  <span
                    key={i.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                  >
                    {i.label}
                    <button
                      type="button"
                      onClick={() => remove(i.id)}
                      aria-label={`Remove ${i.label}`}
                      className="font-bold opacity-80 transition-opacity hover:opacity-100"
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex justify-center">
        <Button onClick={handleSubmit} disabled={submitting} className="h-10 px-8">
          {submitting ? "Analyzing matches…" : "Submit & View Recommendations"}
        </Button>
      </div>
    </div>
  )
}
