import { useState } from 'react';

/** Mount only when the viewer is allowed to see the photo. */
export function WinePhoto({ src, alt, number }: { src: string | null; alt: string; number: string }) {
  return <figure className="wine-photo">
    <span className="photo-number" aria-label={`${number}. tétel`}>{number}</span>
    {src ? <PhotoImage key={src} src={src} alt={alt} /> : <span className="photo-fallback">Nincs borfotó</span>}
  </figure>;
}

function PhotoImage({ src, alt }: { src: string; alt: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  return <>
    {state !== 'ready' && <span className="photo-fallback">{state === 'error' ? 'A kép nem tölthető be.' : 'Kép betöltése…'}</span>}
    {state !== 'error' && <img src={src} alt={alt} width="1086" height="1448" loading="lazy" decoding="async"
      style={{ opacity: state === 'ready' ? 1 : 0 }} onLoad={() => setState('ready')} onError={() => setState('error')} />}
  </>;
}
