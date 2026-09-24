import { useEffect, useState } from 'react';

export function useAmbientMotion() {
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [foreground, setForeground] = useState(() => !document.hidden);
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const onPreference = () => setReduced(preference.matches);
    const onVisibility = () => setForeground(!document.hidden);
    preference.addEventListener('change', onPreference);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      preference.removeEventListener('change', onPreference);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  return { paused, reduced, running: !paused && !reduced && foreground, toggle: () => setPaused(value => !value) };
}

export type AmbientMotion = ReturnType<typeof useAmbientMotion>;
