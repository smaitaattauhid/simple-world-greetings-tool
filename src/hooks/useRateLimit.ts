
import { useState, useCallback } from 'react';

interface RateLimitState {
  [key: string]: {
    count: number;
    lastReset: number;
  };
}

export const useRateLimit = (maxAttempts: number = 5, windowMs: number = 60000) => {
  const [rateLimitState, setRateLimitState] = useState<RateLimitState>({});

  const checkRateLimit = useCallback((key: string): boolean => {
    const now = Date.now();
    const state = rateLimitState[key];

    if (!state) {
      setRateLimitState(prev => ({
        ...prev,
        [key]: { count: 1, lastReset: now }
      }));
      return true;
    }

    // Reset if window has passed
    if (now - state.lastReset > windowMs) {
      setRateLimitState(prev => ({
        ...prev,
        [key]: { count: 1, lastReset: now }
      }));
      return true;
    }

    // Check if under limit
    if (state.count < maxAttempts) {
      setRateLimitState(prev => ({
        ...prev,
        [key]: { ...state, count: state.count + 1 }
      }));
      return true;
    }

    return false;
  }, [rateLimitState, maxAttempts, windowMs]);

  const getRemainingAttempts = useCallback((key: string): number => {
    const state = rateLimitState[key];
    if (!state) return maxAttempts;
    
    const now = Date.now();
    if (now - state.lastReset > windowMs) return maxAttempts;
    
    return Math.max(0, maxAttempts - state.count);
  }, [rateLimitState, maxAttempts, windowMs]);

  const getTimeUntilReset = useCallback((key: string): number => {
    const state = rateLimitState[key];
    if (!state) return 0;
    
    const now = Date.now();
    const timeLeft = windowMs - (now - state.lastReset);
    return Math.max(0, timeLeft);
  }, [rateLimitState, windowMs]);

  return {
    checkRateLimit,
    getRemainingAttempts,
    getTimeUntilReset
  };
};
