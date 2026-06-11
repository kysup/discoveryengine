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
import { Hint } from "@/components/Hint"
import type { Industry, Lead, Pillar } from "@/types"

const SIZES = ["Small", "Medium", "Enterprise"]

type Props = {
  onComplete: (lead: Lead, generatedEmail: string | null) => void
  showHints?: boolean
}

export function Step1({ onComplete, showHints = false }: Props) {
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
  const [firstNameError, setFirstNameError] = useState(false)
  const [lastNameError, setLastNameError] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [companyNameError, setCompanyNameError] = useState(false)
  const [sizeError, setSizeError] = useState(false)
  const [industryError, setIndustryError] = useState(false)
  const [pillarError, setPillarError] = useState(false)

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
    const fne = !firstName.trim()
    const lne = !lastName.trim()
    const emailVal = email.trim()
    const emailInvalid = !emailVal ? "Please enter an email address." : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal) ? "Please enter a valid email address." : null
    const cne = !companyName.trim()
    const se = !companySize
    const ie = !industryId
    const pe = !pillarId
    setFirstNameError(fne)
    setLastNameError(lne)
    setEmailError(emailInvalid)
    setCompanyNameError(cne)
    setSizeError(se)
    setIndustryError(ie)
    setPillarError(pe)
    if (fne || lne || emailInvalid || cne || se || ie || pe) return
    const pillarName = pillars.find((p) => String(p.id) === pillarId)?.name ?? ""
    onComplete(
      { firstName, lastName, email, companyName, companySize, industryId, pillarId, pillarName },
      generatedEmail,
    )
  }

  return (
    <Card className="w-full max-w-md animate-pixelate-in">
      <CardHeader>
        <CardTitle className="text-xl">Software Discovery Engine</CardTitle>
        <CardDescription>Fill out the form to get recommendations.</CardDescription>
      </CardHeader>
      <CardContent>
        <Hint
          active={showHints}
          side="right"
          text="Auto-fills the form with realistic sample data so you can try it instantly."
        >
          <Button
            type="button"
            variant="secondary"
            className="mb-6 h-9 w-full"
            onClick={randomize}
          >
            Randomize Form
          </Button>
        </Hint>

        {loadError && <p className="mb-4 text-sm text-destructive">{loadError}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              value={firstName}
              className={firstNameError ? "border-destructive" : ""}
              onChange={(e) => { setFirstName(e.target.value); setFirstNameError(false) }}
            />
            {firstNameError && <p className="text-xs text-destructive">Please enter a first name.</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              value={lastName}
              className={lastNameError ? "border-destructive" : ""}
              onChange={(e) => { setLastName(e.target.value); setLastNameError(false) }}
            />
            {lastNameError && <p className="text-xs text-destructive">Please enter a last name.</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="text"
              value={email}
              className={emailError ? "border-destructive" : ""}
              onChange={(e) => { setEmail(e.target.value); setEmailError(null) }}
            />
            {emailError && <p className="text-xs text-destructive">{emailError}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="companyName">Company</Label>
            <Input
              id="companyName"
              value={companyName}
              className={companyNameError ? "border-destructive" : ""}
              onChange={(e) => { setCompanyName(e.target.value); setCompanyNameError(false) }}
            />
            {companyNameError && <p className="text-xs text-destructive">Please enter a company name.</p>}
          </div>

          <div className="grid gap-2">
            <Label>Size</Label>
            <Select name="companySize" value={companySize} onValueChange={(v) => { setCompanySize(v); setSizeError(false) }}>
              <SelectTrigger className={`w-full${sizeError ? " border-destructive" : ""}`}>
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
            {sizeError && <p className="text-xs text-destructive">Please select a company size.</p>}
          </div>

          <div className="grid gap-2">
            <Label>Industry</Label>
            <Select name="industry" value={industryId} onValueChange={(v) => { setIndustryId(v); setIndustryError(false) }}>
              <SelectTrigger className={`w-full${industryError ? " border-destructive" : ""}`}>
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
            {industryError && <p className="text-xs text-destructive">Please select an industry.</p>}
          </div>

          <Hint
            active={showHints}
            side="right"
            text="Fields used to get tailored recommendations "
          >
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select name="category" value={pillarId} onValueChange={(v) => { setPillarId(v); setPillarError(false) }}>
                <SelectTrigger className={`w-full${pillarError ? " border-destructive" : ""}`}>
                  <SelectValue placeholder="-- Select Category --" />
                </SelectTrigger>
                <SelectContent>
                  {pillars.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)} disabled={!p.hasIntentions}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {pillarError && <p className="text-xs text-destructive">Please select a category.</p>}
            </div>
          </Hint>

          <Button type="submit" className="mt-2 h-9 w-full">
            Submit &amp; Continue
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
