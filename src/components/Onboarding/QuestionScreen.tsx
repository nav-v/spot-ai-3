import { motion } from 'framer-motion';
import { OptionPicker } from './OptionPicker';
import type { OnboardingQuestion } from '@/lib/onboardingSchema';

interface QuestionScreenProps {
  question: OnboardingQuestion;
  selected: string[];
  onSelectionChange: (selected: string[]) => void;
  questionIndex: number;
  totalQuestions: number;
}

export function QuestionScreen({
  question,
  selected,
  onSelectionChange,
  questionIndex,
  totalQuestions,
}: QuestionScreenProps) {
  // Category colors for visual distinction
  const categoryColors: Record<string, string> = {
    food: 'from-orange-500/20 to-amber-500/20',
    events: 'from-purple-500/20 to-pink-500/20',
    places: 'from-blue-500/20 to-cyan-500/20',
  };

  const categoryEmojis: Record<string, string> = {
    food: '🍽️',
    events: '🎫',
    places: '🗺️',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col h-full"
    >
      {/* Category badge */}
      <div className="flex justify-center mb-4">
        <div className={`
          inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
          bg-gradient-to-r ${categoryColors[question.category]}
          border border-border/50
        `}>
          <span>{categoryEmojis[question.category]}</span>
          <span className="capitalize">{question.category}</span>
          <span className="text-muted-foreground">
            {questionIndex + 1}/{totalQuestions}
          </span>
        </div>
      </div>

      {/* Question text */}
      <div className="text-center mb-6 px-4">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
          {question.question}
        </h2>
        {question.subtext && (
          <p className="text-sm text-muted-foreground">
            {question.subtext}
          </p>
        )}
      </div>

      {/* Options */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <OptionPicker
          options={question.options}
          maxPicks={question.maxPicks}
          selected={selected}
          onSelectionChange={onSelectionChange}
        />
      </div>
    </motion.div>
  );
}

