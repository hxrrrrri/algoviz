import { useEffect, useRef } from 'react';
import useStore from '../store';

const BASE_INTERVAL_MS = 600; // at 1x speed

export function usePlayback() {
  const isPlaying = useStore(s => s.isPlaying);
  const playSpeed = useStore(s => s.playSpeed);
  const currentStep = useStore(s => s.currentStep);
  const trace = useStore(s => s.trace);
  const stepForward = useStore(s => s.stepForward);
  const setPlaying = useStore(s => s.setPlaying);
  
  const intervalRef = useRef(null);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (!isPlaying || trace.length === 0) return;
    
    if (currentStep >= trace.length - 1) {
      setPlaying(false);
      return;
    }
    
    const interval = BASE_INTERVAL_MS / playSpeed;
    intervalRef.current = setInterval(() => {
      const { currentStep: cs, trace: t } = useStore.getState();
      if (cs >= t.length - 1) {
        setPlaying(false);
        clearInterval(intervalRef.current);
      } else {
        stepForward();
      }
    }, interval);
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, playSpeed]);
  
  return { isPlaying, playSpeed };
}
