import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  X,
  ChevronRight,
  ChevronLeft,
  LayoutDashboard,
  Monitor,
  Radio,
  Package,
  Antenna,
  Sparkles,
  CheckCircle,
} from 'lucide-react'

interface TourStep {
  title: string
  description: string
  icon: React.ElementType
  highlight?: string
}

const tourSteps: TourStep[] = [
  {
    title: 'Welcome to SliverUI!',
    description: 'This is your web interface for managing Sliver C2. Let\'s explore the main features in a few simple steps.',
    icon: Sparkles,
  },
  {
    title: 'Dashboard - Overview',
    description: 'Get a quick view of active sessions, beacons, and other important metrics. This is where you start each day.',
    icon: LayoutDashboard,
    highlight: '/dashboard',
  },
  {
    title: 'Sessions - Direct Connections',
    description: 'Sessions are real-time connections. You can run commands, browse files, view processes, and take screenshots instantly.',
    icon: Monitor,
    highlight: '/sessions',
  },
  {
    title: 'Beacons - Periodic Connections',
    description: 'Beacons check in periodically (e.g., every 60 seconds). Queue commands and they execute on the next check-in.',
    icon: Radio,
    highlight: '/beacons',
  },
  {
    title: 'Implants - Create Payloads',
    description: 'Generate new implants to deploy on target machines. Choose OS, format, and configuration to match your environment.',
    icon: Package,
    highlight: '/implants',
  },
  {
    title: 'Listeners - Receive Connections',
    description: 'Start listeners to receive connections from implants. Supports mTLS, HTTPS, HTTP, and DNS protocols.',
    icon: Antenna,
    highlight: '/listeners',
  },
  {
    title: 'You\'re All Set!',
    description: 'Start by launching a Listener, then generate an Implant and deploy it. When the implant connects, you\'ll see a new session/beacon.',
    icon: CheckCircle,
  },
]

interface WelcomeTourProps {
  onComplete: () => void
  onSkip: () => void
}

export function WelcomeTour({ onComplete, onSkip }: WelcomeTourProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const step = tourSteps[currentStep]
  const Icon = step.icon

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      onComplete()
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Tour Card */}
      <div className="relative w-full max-w-lg mx-4 bg-card rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300">
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentStep + 1) / tourSteps.length) * 100}%` }}
          />
        </div>

        {/* Close button */}
        <button
          onClick={onSkip}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Content */}
        <div className="p-8">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
            <Icon className="h-8 w-8 text-primary" />
          </div>

          {/* Step indicator */}
          <p className="text-sm text-muted-foreground mb-2">
            Step {currentStep + 1} of {tourSteps.length}
          </p>

          {/* Title */}
          <h2 className="text-2xl font-bold mb-4">{step.title}</h2>

          {/* Description */}
          <p className="text-muted-foreground leading-relaxed mb-8">
            {step.description}
          </p>

          {/* Step dots */}
          <div className="flex justify-center gap-2 mb-6">
            {tourSteps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={cn(
                  'w-2 h-2 rounded-full transition-all',
                  index === currentStep
                    ? 'w-6 bg-primary'
                    : index < currentStep
                    ? 'bg-primary/50'
                    : 'bg-muted'
                )}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            {currentStep > 0 && (
              <Button variant="outline" onClick={handlePrev} className="flex-1">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <Button onClick={handleNext} className="flex-1">
              {currentStep === tourSteps.length - 1 ? (
                <>
                  Get Started
                  <CheckCircle className="h-4 w-4 ml-1" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>

          {/* Skip link */}
          {currentStep < tourSteps.length - 1 && (
            <button
              onClick={onSkip}
              className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip tutorial
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Hook to manage tour state
export function useTour() {
  const [showTour, setShowTour] = useState(false)

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('hasSeenTour')
    if (!hasSeenTour) {
      setTimeout(() => setShowTour(true), 500)
    }
  }, [])

  const completeTour = () => {
    localStorage.setItem('hasSeenTour', 'true')
    setShowTour(false)
  }

  const skipTour = () => {
    localStorage.setItem('hasSeenTour', 'true')
    setShowTour(false)
  }

  const restartTour = () => {
    localStorage.removeItem('hasSeenTour')
    setShowTour(true)
  }

  return { showTour, completeTour, skipTour, restartTour }
}
