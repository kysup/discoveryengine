import { useEffect, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { generateIdentity, getIndustries, getPillars } from "@/lib/api"
import type { Industry, Lead, Pillar } from "@/types"

const SIZES = ["Small", "Medium", "Enterprise"]

type Props = {
  onComplete: (lead: Lead, generatedEmail: string | null) => void
}

export function Step1({ onComplete }: Props) {
  const [industries, setIndustries] = useState<Industry[]>([])
  const [pillars, setPillars] = useState<Pillar[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [companySize, setCompanySize] = useState("")
  const [industryId, setIndustryId] = useState("")
  const [pillarId, setPillarId] = useState("")
  const [generatedEmail, setGeneratedEmail] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getIndustries(), getPillars()])
      .then(([inds, pils]) => {
        setIndustries(inds)
        setPillars(pils)
      })
      .catch((e) => setLoadError((e as Error).message))
  }, [])

  async function randomize() {
    try {
      const id = await generateIdentity()
      setFirstName(id.firstName)
      setLastName(id.lastName)
      setEmail(id.email)
      setCompanyName(id.companyName)
      setGeneratedEmail(id.email)
    } catch (e) {
      setLoadError((e as Error).message)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onComplete(
      { firstName, lastName, email, companyName, companySize, industryId, pillarId },
      generatedEmail,
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">Software Discovery Engine</CardTitle>
        <CardDescription>Fill out the form to get recommendations.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          variant="secondary"
          className="mb-6 h-9 w-full"
          onClick={randomize}
        >
          Randomize Form
        </Button>

        {loadError && <p className="mb-4 text-sm text-destructive">{loadError}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="companyName">Company</Label>
            <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
          </div>

          <div className="grid gap-2">
            <Label>Size</Label>
            <Select name="companySize" value={companySize} onValueChange={setCompanySize} required>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="-- Select Size --" />
              </SelectTrigger>
              <SelectContent>
                {SIZES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Industry</Label>
            <Select name="industry" value={industryId} onValueChange={setIndustryId} required>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="-- Select Industry --" />
              </SelectTrigger>
              <SelectContent>
                {industries.map((i) => (
                  <SelectItem key={i.id} value={String(i.id)}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Department</Label>
            <Select name="department" value={pillarId} onValueChange={setPillarId} required>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="-- Select Department --" />
              </SelectTrigger>
              <SelectContent>
                {pillars.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)} disabled={!p.hasIntentions}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="mt-2 h-9 w-full">
            Submit &amp; Continue
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
