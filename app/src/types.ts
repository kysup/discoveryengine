export type Pillar = { id: number; name: string; hasIntentions: boolean }
export type Industry = { id: number; name: string }
export type Identity = {
  firstName: string
  lastName: string
  email: string
  companyName: string
}

export type Lead = {
  firstName: string
  lastName: string
  email: string
  companyName: string
  companySize: string
  industryId: string
  pillarId: string
  pillarName: string
}

export type Intention = {
  id: number
  label: string
  type: string
  productAffinity: number
  engagementScore: number
  blendedScore: number
}

export type Recommendation = {
  product_id: number
  product_name: string
  company_name: string
  product_url: string | null
  logo_url: string | null
  total_score: number
  justifications: string[]
}
