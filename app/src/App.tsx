import { useState } from "react"
import { Step1 } from "@/components/steps/Step1"
import { Step2 } from "@/components/steps/Step2"
import { Step3 } from "@/components/steps/Step3"
import type { Lead, Recommendation } from "@/types"

export default function App() {
  const [step, setStep] = useState(1)
  const [lead, setLead] = useState<Lead | null>(null)
  const [generatedEmail, setGeneratedEmail] = useState<string | null>(null)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      {step === 1 && (
        <Step1
          onComplete={(l, gen) => {
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
    </div>
  )
}
