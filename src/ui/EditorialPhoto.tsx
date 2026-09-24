import { useState, type ReactNode } from 'react';
import './editorial.css';

export function EditorialPhoto({ src, alt, number, caption, eager = false, width = 1086, height = 1448 }: {
  src: string; alt: string; number: string; caption: ReactNode; eager?: boolean; width?: number; height?: number;
}) {
  const [failed, setFailed] = useState(false);
  return <figure className="editorial-photo">
    <div className="editorial-photo-media">
      {failed ? <div className="editorial-photo-fallback"><TastingSeal /><p>A kép nem érhető el.</p></div>
        : <img src={src} alt={alt} width={width} height={height} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} />}
      <span className="editorial-photo-number" aria-hidden="true">{number}</span>
    </div>
    <figcaption>{caption}</figcaption>
  </figure>;
}

export function TastingSeal() {
  return <svg className="tasting-seal" viewBox="0 0 100 100" fill="none" aria-hidden="true" focusable="false">
    <circle cx="50" cy="50" r="46" stroke="currentColor" />
    <circle cx="50" cy="50" r="39" stroke="currentColor" strokeDasharray="1 5" />
    <path d="M36 26h28c4 18 2 31-14 31S32 44 36 26Zm14 31v18m-12 0h24M35 38h30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="m21 47 6 6m46-6 6 6" stroke="currentColor" />
  </svg>;
}
