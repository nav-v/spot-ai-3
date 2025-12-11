import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import type { Persona } from '@/lib/personaCalculator';

interface PersonaRevealProps {
  primaryPersona: Persona;
  secondaryPersona: Persona | null;
  onComplete: () => void;
  onLinkInstagram?: () => void;
}

export function PersonaReveal({ 
  primaryPersona, 
  secondaryPersona, 
  onComplete,
  onLinkInstagram 
}: PersonaRevealProps) {
  const [stage, setStage] = useState<'building' | 'reveal' | 'comment'>('building');

  useEffect(() => {
    // Stage progression
    const timer1 = setTimeout(() => setStage('reveal'), 1500);
    const timer2 = setTimeout(() => setStage('comment'), 3000);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6">
      {/* Building stage */}
      {stage === 'building' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="text-center"
        >
          {/* Animated dots */}
          <div className="flex justify-center gap-2 mb-6">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-4 h-4 rounded-full bg-primary"
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>
          <p className="text-lg text-muted-foreground">Getting to know you...</p>
        </motion.div>
      )}

      {/* Reveal stage */}
      {(stage === 'reveal' || stage === 'comment') && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, type: 'spring' }}
          className="text-center max-w-md"
        >
          {/* Primary persona card */}
          <motion.div
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            className="mb-6"
          >
            <motion.div
              className="text-7xl mb-4"
              animate={{ 
                rotate: [0, -10, 10, -10, 0],
                scale: [1, 1.1, 1],
              }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {primaryPersona.emoji}
            </motion.div>
            
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              {primaryPersona.name}
            </h2>
            
            {secondaryPersona && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-lg text-muted-foreground"
              >
                with a splash of {secondaryPersona.emoji} {secondaryPersona.name}
              </motion.p>
            )}
          </motion.div>

          {/* Spot's comment */}
          {stage === 'comment' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-8"
            >
              <div className="inline-flex items-start gap-3 bg-card border border-border rounded-2xl p-4 text-left max-w-sm">
                <div className="w-8 h-8 rounded-full bg-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm sm:text-base text-foreground">
                  {primaryPersona.spotComment}
                </p>
              </div>
            </motion.div>
          )}

          {/* Action buttons */}
          {stage === 'comment' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col gap-3 w-full max-w-xs mx-auto"
            >
              <Button
                onClick={onComplete}
                size="lg"
                className="text-base font-semibold"
              >
                Start exploring
              </Button>
              
              {onLinkInstagram && (
                <Button
                  onClick={onLinkInstagram}
                  variant="outline"
                  size="lg"
                  className="text-base"
                >
                  📸 Link Instagram (save via DM)
                </Button>
              )}
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}

