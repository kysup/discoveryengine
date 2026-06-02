import type {
  Identity,
  Industry,
  Intention,
  Lead,
  Pillar,
  Recommendation,
} from "@/types"

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const b = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(b.error || `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const getPillars = () =>
  getJson<{ pillars: Pillar[] }>("/api/pillars").then((d) => d.pillars)

export const getIndustries = () =>
  getJson<{ industries: Industry[] }>("/api/industries").then((d) => d.industries)

export const generateIdentity = () => getJson<Identity>("/api/generate-identity")

export const getIntentionsWithScores = (pillarId: string, industryId: string) =>
  getJson<{ topIntentions: Intention[]; allIntentions: Intention[] }>(
    `/api/intentions-with-scores?pillarId=${encodeURIComponent(
      pillarId,
    )}&industryId=${encodeURIComponent(industryId)}`,
  )

export const submitLead = (lead: Lead, intentionIds: number[]) =>
  postJson<{ success: boolean; leadId: number; recommendations: Recommendation[] }>(
    "/api/submit-lead",
    { ...lead, intentionIds },
  )

export const updateIntentionScores = (intentionIds: number[]) =>
  postJson<{ success: boolean }>("/api/update-intention-scores", { intentionIds })

export const emailRecommendations = (payload: {
  email: string
  firstName: string
  companyName: string
  recommendations: Recommendation[]
}) =>
  postJson<{ success: boolean; id?: string }>("/api/email-recommendations", payload)
