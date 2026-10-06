import { useEffect, useState } from 'react';

const duration = 900;
const prefersStill = () => typeof window === 'undefined' || !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Counts a revealed number up from zero once, on mount. Reduced motion shows the value at once. */
export function CountUp({ value, format, step = 1, delay = 0 }: { value: number; format: (value: number) => string; step?: number; delay?: number }) {
  const [shown, setShown] = useState(() => prefersStill() ? value : 0);
  useEffect(() => {
    let frame = 0;
    const still = prefersStill();
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const progress = still ? 1 : Math.min(1, Math.max(0, (now - start) / duration));
      const eased = 1 - (1 - progress) ** 3;
      setShown(progress >= 1 ? value : Math.round(value * eased / step) * step);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, step, delay]);
  return <>{format(shown)}</>;
}
