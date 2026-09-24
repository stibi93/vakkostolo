import { useEffect, useState } from 'react';

/** Abstract label: contains no wine identity or bottle colour. */
export function LabelArtwork({ animated = false }: { animated?: boolean }) {
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(preference.matches);
    preference.addEventListener('change', change);
    return () => preference.removeEventListener('change', change);
  }, []);
  return <div className={`label-stage${animated && !paused && !reduced ? ' label-moving' : ''}`}>
    <div className="glass-ring" aria-hidden="true" /><div className="glass-ring glass-ring-second" aria-hidden="true" />
    {animated && <button className="motion-toggle" aria-pressed={paused || reduced} disabled={reduced} onClick={() => setPaused(!paused)}>
      {reduced ? 'Mozgás kikapcsolva' : paused ? 'Háttérmozgás indítása' : 'Háttérmozgás szüneteltetése'}
    </button>}
    <div className="label-poster" aria-hidden="true">
      <div className="label-meta"><span>VAKKÓSTOLÓ</span><span>01 / 03</span></div>
      <div className="label-number">01</div>
      <div className="label-mask">A bor neve egyelőre rejtve.</div>
      <div className="label-foot">kóstolási tétel</div>
    </div>
    <div className="stage-caption" aria-hidden="true"><span>SZÁMOZOTT MINTA</span></div>
  </div>;
}
