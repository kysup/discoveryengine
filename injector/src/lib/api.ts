import type { IdName, IntentionLite, ProductLite } from "@/types"

async function getData<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const body = (await res.json().catch(() => ({}))) as { data?: T; error?: string }
  if (!res.ok) throw new Error(body.error || `Request failed: ${res.status}`)
  return body.data as T
}

async function post<T>(url: string, payload: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const body = (await res.json().catch(() => ({}))) as { data?: T; error?: string }
  if (!res.ok) throw new Error(body.error || `Request failed: ${res.status}`)
  return body.data as T
}

export const getIndustries = () => getData<IdName[]>("/api/industries")
export const getPillars = () => getData<IdName[]>("/api/pillars")
export const getProducts = () => getData<ProductLite[]>("/api/products")
export const getIntentions = () => getData<IntentionLite[]>("/api/intentions")

export const createProduct = (company_name: string, product_name: string) =>
  post<{ id: number }>("/api/products", { company_name, product_name })

export const linkProductIndustry = (product_id: number, industry_id: number) =>
  post("/api/product-industries", { product_id, industry_id })

export const createIntention = (label: string, type: string) =>
  post<{ id: number }>("/api/intentions", { label, type })

export const linkIntentionPillar = (intention_id: number, pillar_id: number) =>
  post("/api/intention-pillars", { intention_id, pillar_id })

export const createProductIntention = (
  product_id: number,
  intention_id: number,
  score: number,
) => post("/api/product-intentions", { product_id, intention_id, score })
