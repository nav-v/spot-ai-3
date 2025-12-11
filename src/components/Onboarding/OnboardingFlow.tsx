import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SplashScreen } from './SplashScreen';
import { QuestionScreen } from './QuestionScreen';
import { PersonaReveal } from './PersonaReveal';
import { ONBOARDING_QUESTIONS, getTagsFromSelections } from '@/lib/onboardingSchema';
import { getTopPersonas } from '@/lib/personaCalculator';
import { preferencesApi } from '@/lib/api';

type OnboardingStage = 'splash' | 'questions' | 'reveal' | 'complete';

interface OnboardingFlowProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function OnboardingFlow({ onComplete, onSkip }: OnboardingFlowProps) {
  const [stage, setStage] = useState<OnboardingStage>('splash');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [personas, setPersonas] = useState<{ primary: any; secondary: any } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const currentQuestion = ONBOARDING_QUESTIONS[currentQuestionIndex];
  const totalQuestions = ONBOARDING_QUESTIONS.length;

  // Get current selections for the active question
  const currentSelections = selections[currentQuestion?.id] || [];

  // Handle selection changes
  const handleSelectionChange = useCallback((selected: string[]) => {
    setSelections(prev => ({
      ...prev,
      [currentQuestion.id]: selected,
    }));
  }, [currentQuestion?.id]);

  // Navigation
  const canGoNext = currentSelections.length > 0;
  const canGoBack = currentQuestionIndex > 0;
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  const handleNext = async () => {
    if (isLastQuestion) {
      // Calculate personas and save
      setIsSaving(true);
      try {
        const allTags = getTagsFromSelections(selections);
        const { primary, secondary } = getTopPersonas(allTags);
        
        setPersonas({ primary, secondary });
        
        // Save to database
        await preferencesApi.save(
          selections,
          allTags,
          primary.id,
          secondary?.id || null
        );
        
        setStage('reveal');
      } catch (error) {
        console.error('Failed to save preferences:', error);
        // Still show reveal even if save fails
        const allTags = getTagsFromSelections(selections);
        const { primary, secondary } = getTopPersonas(allTags);
        setPersonas({ primary, secondary });
        setStage('reveal');
      } finally {
        setIsSaving(false);
      }
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleStart = () => {
    setStage('questions');
  };

  const handleSkip = async () => {
    try {
      await preferencesApi.skip();
    } catch (error) {
      console.error('Failed to mark onboarding as skipped:', error);
    }
    onSkip();
  };

  const handleRevealComplete = () => {
    onComplete();
  };

  // Render based on stage
  if (stage === 'splash') {
    return <SplashScreen onStart={handleStart} onSkip={handleSkip} />;
  }

  if (stage === 'reveal' && personas) {
    return (
      <PersonaReveal
        primaryPersona={personas.primary}
        secondaryPersona={personas.secondary}
        onComplete={handleRevealComplete}
      />
    );
  }

  // Questions stage
  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Progress bar */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-2">
          {/* Back button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            disabled={!canGoBack}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          {/* Progress dots */}
          <div className="flex-1 flex justify-center gap-1.5">
            {ONBOARDING_QUESTIONS.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === currentQuestionIndex
                    ? 'w-6 bg-primary'
                    : index < currentQuestionIndex
                      ? 'w-1.5 bg-primary/60'
                      : 'w-1.5 bg-muted'
                }`}
              />
            ))}
          </div>
          
          {/* Skip button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="text-xs text-muted-foreground"
          >
            Skip
          </Button>
        </div>
      </div>

      {/* Question content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <QuestionScreen
            key={currentQuestion.id}
            question={currentQuestion}
            selected={currentSelections}
            onSelectionChange={handleSelectionChange}
            questionIndex={currentQuestionIndex}
            totalQuestions={totalQuestions}
          />
        </AnimatePresence>
      </div>

      {/* Navigation footer */}
      <div className="p-4 border-t border-border bg-background">
        <Button
          onClick={handleNext}
          disabled={!canGoNext || isSaving}
          className="w-full"
          size="lg"
        >
          {isSaving ? (
            <span className="flex items-center gap-2">
              <motion.div
                className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
              Saving...
            </span>
          ) : isLastQuestion ? (
            'See my results'
          ) : (
            <span className="flex items-center gap-1">
              Next <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}

// Export individual components for flexibility
export { SplashScreen } from './SplashScreen';
export { QuestionScreen } from './QuestionScreen';
export { PersonaReveal } from './PersonaReveal';
export { OptionPicker } from './OptionPicker';

