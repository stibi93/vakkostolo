import { createContext, useContext } from 'react';
import type { AmbientMotion } from './useAmbientMotion';

export const AppMotionContext = createContext<AmbientMotion | null>(null);

export function useAppMotion(): AmbientMotion {
  const motion = useContext(AppMotionContext);
  if (!motion) throw new Error('AppMotionContext is required');
  return motion;
}
