import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ProductCard } from "@/components/steps/ProductCard"
import { emailRecommendations } from "@/lib/api"
import type { Lead, Recommendation } from "@/types"

type Props = {
  lead: Lead
  generatedEmail: string | null
  recommendations: Recommendation[]
}

export function Step3({ lead, generatedEmail, recommendations }: Props) {
  const emailRef = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState(lead.email)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null)

  async function send() {
    const value = email.trim()
    const input = emailRef.current
    if (!value) {
      input?.setCustomValidity("Please enter an email address.")
      input?.reportValidity()
      return
    }
    // Block the unchanged auto-generated email: it points at a fake domain and would
    // just bounce. Native validation tooltip, same as a required field in step 1.
    if (generatedEmail && value.toLowerCase() === generatedEmail.toLowerCase()) {
      input?.setCustomValidity("Use a real email to see this feature in action!")
      input?.reportValidity()
      return
    }
    input?.setCustomValidity("")
    setSending(true)
    setStatus(null)
    try {
      await emailRecommendations({
        email: value,
        firstName: lead.firstName,
        companyName: lead.companyName,
        recommendations,
      })
      setStatus({ ok: true, msg: "Sent! Check your inbox." })
    } catch (e) {
      setStatus({ ok: false, msg: (e as Error).message })
    }
    setSending(false)
  }

  return (
    <div className="w-full max-w-3xl">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row">
        <h1 className="text-2xl font-semibold">Recommended Software</h1>

        <div className="flex w-full max-w-xs flex-col gap-2">
          <p className="text-right text-sm font-medium">Email these suggestions to yourself</p>
          <div className="flex gap-2">
            <Input
              ref={emailRef}
              type="email"
              value={email}
              placeholder="you@company.com"
              onChange={(e) => {
                setEmail(e.target.value)
                emailRef.current?.setCustomValidity("")
              }}
            />
            <Button onClick={send} disabled={sending}>
              {sending ? "Sending…" : "Send"}
            </Button>
          </div>
          {status && (
            <span
              className={
                status.ok
                  ? "text-right text-sm text-emerald-600"
                  : "text-right text-sm text-destructive"
              }
            >
              {status.msg}
            </span>
          )}
        </div>
      </div>

      {recommendations.length === 0 ? (
        <p className="text-muted-foreground">
          No matching tools found for your configuration.
        </p>
      ) : (
        <div className="flex flex-col items-center gap-4">
          {recommendations.map((rec, i) => (
            <ProductCard key={rec.product_id} rec={rec} rank={i} />
          ))}
        </div>
      )}
    </div>
  )
}
