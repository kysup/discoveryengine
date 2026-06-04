import { useState } from "react"
import { Step1 } from "@/components/steps/Step1"
import { Step2 } from "@/components/steps/Step2"
import { Step3 } from "@/components/steps/Step3"
import { Button } from "@/components/ui/button"
import type { Lead, Recommendation } from "@/types"

const ONBOARD_KEY = "de_onboarded"

export default function App() {
  const [step, setStep] = useState(1)
  const [lead, setLead] = useState<Lead | null>(null)
  const [generatedEmail, setGeneratedEmail] = useState<string | null>(null)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])

  // First-load feature hints: show once, then remember in localStorage.
  const [showHints, setShowHints] = useState(() => {
    try {
      return !localStorage.getItem(ONBOARD_KEY)
    } catch {
      return false
    }
  })

  function finishOnboarding() {
    try {
      localStorage.setItem(ONBOARD_KEY, "1")
    } catch {
      /* ignore (e.g. storage disabled) */
    }
    setShowHints(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      {step === 1 && (
        <Step1
          showHints={showHints}
          onComplete={(l, gen) => {
            finishOnboarding()
            setLead(l)
            setGeneratedEmail(gen)
            setStep(2)
          }}
        />
      )}

      {step === 2 && lead && (
        <Step2
          lead={lead}
          onComplete={(recs) => {
            setRecommendations(recs)
            setStep(3)
          }}
        />
      )}

      {step === 3 && lead && (
        <Step3
          lead={lead}
          generatedEmail={generatedEmail}
          recommendations={recommendations}
        />
      )}

      {step === 1 && showHints && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <Button onClick={finishOnboarding} size="lg" className="h-10 px-6 shadow-lg">
            Got it
          </Button>
        </div>
      )}
    </div>
  )
}
