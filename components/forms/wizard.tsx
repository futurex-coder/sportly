'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

export interface WizardStep {
  title: string;
  description?: string;
}

interface WizardProps {
  steps: WizardStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  canAdvance?: boolean;
  submitLabel?: string;
  children: React.ReactNode;
}

export default function Wizard({
  steps,
  currentStep,
  onStepChange,
  onSubmit,
  isSubmitting = false,
  canAdvance = true,
  submitLabel = 'Submit',
  children,
}: WizardProps) {
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="space-y-8">
      {/* Step indicator */}
      <nav className="flex items-center justify-center gap-2">
        {steps.map((step, i) => {
          const isComplete = i < currentStep;
          const isCurrent = i === currentStep;
          return (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={cn(
                    'h-px w-8 sm:w-12',
                    isComplete ? 'bg-primary' : 'bg-border'
                  )}
                />
              )}
              <button
                type="button"
                onClick={() => i < currentStep && onStepChange(i)}
                disabled={i > currentStep}
                className={cn(
                  'flex items-center gap-2 rounded-full text-sm font-medium transition-colors',
                  isCurrent && 'text-primary',
                  isComplete && 'text-primary cursor-pointer',
                  !isCurrent && !isComplete && 'text-muted-foreground'
                )}
              >
                <span
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full border text-xs font-semibold',
                    isCurrent && 'border-primary bg-primary text-primary-foreground',
                    isComplete && 'border-primary bg-primary/10 text-primary',
                    !isCurrent && !isComplete && 'border-border'
                  )}
                >
                  {isComplete ? <Check className="size-4" /> : i + 1}
                </span>
                <span className="hidden sm:inline">{step.title}</span>
              </button>
            </div>
          );
        })}
      </nav>

      {/* Step content */}
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">{steps[currentStep].title}</h2>
          {steps[currentStep].description && (
            <p className="text-muted-foreground text-sm">
              {steps[currentStep].description}
            </p>
          )}
        </div>

        {children}

        {/* Navigation */}
        <div className="mt-8 flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onStepChange(currentStep - 1)}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="mr-1 size-4" />
            Back
          </Button>

          {isLast ? (
            <Button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting || !canAdvance}
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {submitLabel}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => onStepChange(currentStep + 1)}
              disabled={!canAdvance}
            >
              Next
              <ChevronRight className="ml-1 size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
