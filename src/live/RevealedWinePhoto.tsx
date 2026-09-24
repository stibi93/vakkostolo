import { useEffect, useState } from 'react';
import { WinePhoto } from '../ui/WinePhoto';
import type { GameSnapshot, LiveApi } from './model';

/** Only mounted from the server's revealed list; Storage independently enforces membership/reveal. */
export function RevealedWinePhoto({ api, gameId, wine }: {
  api: LiveApi; gameId: string; wine: NonNullable<GameSnapshot['revealed']>[number];
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    api.photoUrl?.(gameId, wine.id).then(value => { if (active) setUrl(value); }, () => {});
    return () => { active = false; };
  }, [api, gameId, wine.id]);
  // Photos are optional. A missing/inaccessible file must not prevent viewing revealed wine data.
  return url ? <div className="live-revealed-photo"><WinePhoto src={url} alt={`${wine.name} – borfotó`}
    number={String(wine.position).padStart(2, '0')} /></div> : null;
}
