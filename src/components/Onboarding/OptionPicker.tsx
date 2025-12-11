import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { OnboardingOption } from '@/lib/onboardingSchema';

interface OptionPickerProps {
  options: OnboardingOption[];
  maxPicks: number;
  selected: string[];
  onSelectionChange: (selected: string[]) => void;
}

export function OptionPicker({ options, maxPicks, selected, onSelectionChange }: OptionPickerProps) {
  const [shake, setShake] = useState(false);

  const toggleOption = (optionId: string) => {
    if (selected.includes(optionId)) {
      // Deselect
      onSelectionChange(selected.filter(id => id !== optionId));
    } else if (selected.length < maxPicks) {
      // Select
      onSelectionChange([...selected, optionId]);
    } else {
      // At max - shake to indicate
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  const isSelected = (optionId: string) => selected.includes(optionId);
  const isDisabled = (optionId: string) => !isSelected(optionId) && selected.length >= maxPicks;

  return (
    <div className="w-full">
      {/* Selection counter */}
      <div className="flex justify-center mb-4">
        <div className="flex gap-1.5">
          {Array.from({ length: maxPicks }).map((_, i) => (
            <motion.div
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-colors duration-200 ${
                i < selected.length ? 'bg-primary' : 'bg-muted'
              }`}
              animate={shake && i === maxPicks - 1 ? { scale: [1, 1.3, 1] } : {}}
            />
          ))}
        </div>
        <span className="ml-2 text-xs text-muted-foreground">
          {selected.length}/{maxPicks}
        </span>
      </div>

      {/* Options grid */}
      <motion.div 
        className="grid grid-cols-2 gap-2 sm:gap-3"
        animate={shake ? { x: [0, -5, 5, -5, 5, 0] } : {}}
        transition={{ duration: 0.4 }}
      >
        {options.map((option) => (
          <motion.button
            key={option.id}
            onClick={() => toggleOption(option.id)}
            disabled={isDisabled(option.id)}
            className={`
              relative p-3 sm:p-4 rounded-xl text-left transition-all duration-200
              border-2 
              ${isSelected(option.id) 
                ? 'border-primary bg-primary/10 shadow-md' 
                : isDisabled(option.id)
                  ? 'border-muted bg-muted/30 opacity-50 cursor-not-allowed'
                  : 'border-border bg-card hover:border-primary/50 hover:bg-accent/50'
              }
            `}
            whileTap={!isDisabled(option.id) ? { scale: 0.97 } : {}}
            layout
          >
            {/* Selection checkmark */}
            <AnimatePresence>
              {isSelected(option.id) && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                >
                  <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Emoji */}
            <span className="text-2xl sm:text-3xl mb-1 block">{option.emoji}</span>
            
            {/* Label */}
            <span className={`text-sm sm:text-base font-medium leading-tight block ${
              isSelected(option.id) ? 'text-primary' : 'text-foreground'
            }`}>
              {option.label}
            </span>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}

