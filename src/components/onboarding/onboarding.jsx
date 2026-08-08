import { useState } from 'react'
import IdentityStep from './identityStep.jsx'
import InterestsStep from './interestsStep.jsx'
import LocationStep from './locationStep.jsx'

const Onboarding = () => {
  const [step, setStep] = useState(1)

  return (
    <main className="min-h-dvh bg-vibe-bg text-vibe-text">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+2rem)]">
        <div className="mb-8 flex gap-2">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                item <= step ? (item === 1 ? 'bg-vibe-petrol' : item === 2 ? 'bg-vibe-apricot' : 'bg-vibe-lime') : 'bg-vibe-petrol/10'
              }`}
            />
          ))}
        </div>

        {step === 1 && <IdentityStep onNext={() => setStep(2)} />}
        {step === 2 && <InterestsStep onBack={() => setStep(1)} onNext={() => setStep(3)} />}
        {step === 3 && <LocationStep onBack={() => setStep(2)} />}
      </div>
    </main>
  )
}

export default Onboarding
