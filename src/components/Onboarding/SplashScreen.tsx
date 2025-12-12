import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface SplashScreenProps {
  onStart: () => void;
  onSkip: () => void;
}

export function SplashScreen({ onStart, onSkip }: SplashScreenProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [showButtons, setShowButtons] = useState(false);

  const fullText = `Hey! I'm Spot ✨

I'm basically that friend who always knows a place — except I actually remember to save them.

Before I start finding your perfect spots, let me get to know you a little...

5 quick questions. Pick what vibes with you.`;

  // Typewriter effect
  useEffect(() => {
    let index = 0;
    setIsTyping(true);
    
    const typeInterval = setInterval(() => {
      if (index < fullText.length) {
        setDisplayedText(fullText.slice(0, index + 1));
        index++;
      } else {
        clearInterval(typeInterval);
        setIsTyping(false);
        // Show buttons after a short delay
        setTimeout(() => setShowButtons(true), 300);
      }
    }, 30); // Speed of typing

    return () => clearInterval(typeInterval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6">
      {/* Pulsating Spot dot */}
      <motion.div
        className="w-16 h-16 rounded-full bg-primary mb-8 shadow-lg"
        animate={{
          scale: isTyping ? [1, 1.15, 1] : [1, 1.05, 1],
          boxShadow: isTyping 
            ? ['0 0 0 0 rgba(249, 115, 22, 0.4)', '0 0 0 20px rgba(249, 115, 22, 0)', '0 0 0 0 rgba(249, 115, 22, 0.4)']
            : ['0 0 0 0 rgba(249, 115, 22, 0.2)', '0 0 0 10px rgba(249, 115, 22, 0)', '0 0 0 0 rgba(249, 115, 22, 0.2)'],
        }}
        transition={{
          duration: isTyping ? 0.5 : 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Text container */}
      <div className="max-w-md text-center mb-8">
        <p className="text-lg sm:text-xl text-foreground whitespace-pre-line leading-relaxed">
          {displayedText}
          {isTyping && (
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="inline-block w-0.5 h-5 bg-primary ml-0.5 align-middle"
            />
          )}
        </p>
      </div>

      {/* Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={showButtons ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row gap-3 w-full max-w-sm"
      >
        <Button
          onClick={onStart}
          className="w-full rounded-full py-3 text-base font-semibold shadow-sm"
        >
          Let's do it
        </Button>
        <Button
          onClick={onSkip}
          variant="ghost"
          className="w-full rounded-full py-3 text-base text-muted-foreground"
        >
          Maybe later
        </Button>
      </motion.div>
    </div>
  );
}

