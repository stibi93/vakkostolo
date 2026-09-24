import { useEffect, useRef, useState } from 'react';
import { WinePhoto } from '../ui/WinePhoto';
import { gameErrorMessage } from './api';
import { prepareWinePhoto, WinePhotoError } from './winePhoto';
import type { GamesApi, HostWine } from './model';

const number = (position: number) => String(position).padStart(2, '0');

/** Host-only: the photo usually identifies the wine, so it is never rendered in player views before reveal. */
export function WinePhotoField({ api, gameId, wine }: { api: GamesApi; gameId: string; wine: HostWine }) {
  const [updatedAt, setUpdatedAt] = useState(wine.photoUpdatedAt);
  const [signed, setSigned] = useState<{ version: string; url: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!updatedAt) return;
    let active = true;
    api.photoUrl(gameId, wine.roundId).then((url) => { if (active) setSigned({ version: updatedAt, url }); },
      (error: unknown) => { if (active) setMessage(gameErrorMessage(error)); });
    return () => { active = false; };
  }, [api, gameId, wine.roundId, updatedAt]);

  async function run(action: () => Promise<string | null>, done: string) {
    setPending(true);
    try {
      const next = await action();
      if (!mounted.current) return;
      setUpdatedAt(next);
      setMessage(done);
    } catch (error) {
      if (mounted.current) setMessage(error instanceof WinePhotoError ? error.message : gameErrorMessage(error));
    } finally {
      if (mounted.current) setPending(false);
    }
  }
  function select(file: File) {
    void run(async () => {
      setMessage('Fotó előkészítése…');
      const photo = await prepareWinePhoto(file);
      setMessage('Fotó feltöltése…');
      await api.uploadPhoto(gameId, wine.roundId, photo);
      return new Date().toISOString();
    }, 'Fotó mentve. A játékosok csak a bor felfedésekor látják.');
  }

  const url = updatedAt && signed?.version === updatedAt ? signed.url : null;
  const id = `host-wine-photo-${wine.position}`;
  const label = ` · ${wine.position}. tétel`;
  return <div className="host-wine-photo">
    <WinePhoto src={url} alt={`${wine.name} – borfotó`} number={number(wine.position)} />
    <div>
      {wine.photoLocked
        ? <p className="small-note">A bor felfedve, a fotó már nem módosítható.</p>
        : <>
          <div className="upload-control" aria-disabled={pending}>
            <label htmlFor={id}>{updatedAt ? 'Fotó cseréje' : 'Fotó hozzáadása'}<span className="sr-only">{label}</span></label>
            <input id={id} type="file" accept="image/*" disabled={pending} aria-describedby={`${id}-message`} onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (file) select(file);
            }} />
          </div>
          {updatedAt && <div className="photo-actions">
            <button type="button" className="button-secondary" disabled={pending} onClick={() => void run(async () => {
              await api.removePhoto(gameId, wine.roundId);
              return null;
            }, 'Fotó törölve.')}>Fotó törlése<span className="sr-only">{label}</span></button>
          </div>}
        </>}
      <p className="small-note" id={`${id}-message`} aria-live="polite">
        {message || (updatedAt ? 'A fotót csak te látod; a játékosok a felfedéskor.' : 'Nincs fotó. Nem kötelező, a felfedésnél és az eredményeknél jelenik meg.')}
      </p>
    </div>
  </div>;
}
