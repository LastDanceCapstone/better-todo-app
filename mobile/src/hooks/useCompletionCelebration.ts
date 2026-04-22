import { useCallback, useState } from 'react';

interface CompletionCelebrationOptions {
  autoHideDuration?: number;
}

export const useCompletionCelebration = (
  options: CompletionCelebrationOptions = {}
) => {
  const { autoHideDuration = 3500 } = options;
  const [isCelebrating, setIsCelebrating] = useState(false);

  const triggerCelebration = useCallback(async () => {
    setIsCelebrating(true);
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        setIsCelebrating(false);
        resolve();
      }, autoHideDuration);
      return () => clearTimeout(timer);
    });
  }, [autoHideDuration]);

  const resetCelebration = useCallback(() => {
    setIsCelebrating(false);
  }, []);

  return {
    isCelebrating,
    triggerCelebration,
    resetCelebration,
  };
};
