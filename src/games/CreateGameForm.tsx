import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { WinePhoto } from '../ui/WinePhoto';
import { gameErrorMessage } from './api';
import { parseAlcohol, validateGameInput } from './model';
import type { GamesApi } from './model';
import { prepareWinePhoto, WinePhotoError } from './winePhoto';

type PickedPhoto = { blob: Blob; url: string };
type WineFields = { id: string; name: string; price: string; alcohol: string; photo: PickedPhoto | null; photoMessage: string };
const emptyWine = (): WineFields => ({ id: crypto.randomUUID(), name: '', price: '', alcohol: '', photo: null, photoMessage: '' });
export function CreateGameForm({ api }: { api: GamesApi }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [seconds, setSeconds] = useState('120');
  const [reveal, setReveal] = useState('2');
  const [wines, setWines] = useState<WineFields[]>(() => [emptyWine()]);
  const [requestId] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState<false | 'game' | 'photos'>(false);
  const [errors, setErrors] = useState<string[]>([]);
  const mounted = useRef(true);
  const submitting = useRef(false);
  const errorBox = useRef<HTMLDivElement>(null);
  const photoUrls = useRef(new Set<string>());
  useEffect(() => {
    mounted.current = true;
    const urls = photoUrls.current;
    return () => { mounted.current = false; urls.forEach((url) => URL.revokeObjectURL(url)); urls.clear(); };
  }, []);
  useEffect(() => { if (errors.length) errorBox.current?.focus(); }, [errors]);

  function updateWine(id: string, field: 'name' | 'price' | 'alcohol', value: string) {
    setWines((current) => current.map((wine) => wine.id === id ? { ...wine, [field]: value } : wine));
  }
  function setPhoto(id: string, photo: PickedPhoto | null, photoMessage: string) {
    setWines((current) => current.map((wine) => {
      if (wine.id !== id) return wine;
      if (wine.photo && wine.photo !== photo) { URL.revokeObjectURL(wine.photo.url); photoUrls.current.delete(wine.photo.url); }
      return { ...wine, photo, photoMessage };
    }));
  }
  async function pickPhoto(id: string, file: File) {
    setWines((current) => current.map((wine) => wine.id === id ? { ...wine, photoMessage: 'Fotó előkészítése…' } : wine));
    try {
      const blob = await prepareWinePhoto(file);
      if (!mounted.current) return;
      const url = URL.createObjectURL(blob);
      photoUrls.current.add(url);
      setPhoto(id, { blob, url }, 'A fotó a kóstoló létrehozásakor töltődik fel.');
    } catch (error) {
      if (!mounted.current) return;
      const message = error instanceof WinePhotoError ? error.message : 'A kép nem dolgozható fel. Válassz másik fájlt.';
      setWines((current) => current.map((wine) => wine.id === id ? { ...wine, photoMessage: message } : wine));
    }
  }
  function removeWine(id: string) {
    setWines((current) => current.filter((wine) => {
      if (wine.id === id && wine.photo) { URL.revokeObjectURL(wine.photo.url); photoUrls.current.delete(wine.photo.url); }
      return wine.id !== id;
    }));
  }
  function moveWine(index: number, offset: number) {
    setWines((current) => {
      const next = [...current];
      [next[index], next[index+offset]] = [next[index+offset], next[index]];
      return next;
    });
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    const input = { title, roundSeconds: Number(seconds), revealEvery: Number(reveal),
      wines: wines.map((wine) => ({ name: wine.name, priceHuf: wine.price.trim() ? Number(wine.price) : NaN,
        alcoholTenths: parseAlcohol(wine.alcohol) })) };
    const invalid = validateGameInput(input);
    setErrors(invalid);
    if (invalid.length) return;
    submitting.current = true;
    setPending('game');
    try {
      const id = await api.create(input, requestId);
      const photos = wines.flatMap((wine, index) => wine.photo ? [{ index, blob: wine.photo.blob }] : []);
      let photoFailures = 0;
      if (photos.length) {
        if (mounted.current) setPending('photos');
        try {
          const game = await api.get(id);
          for (const photo of photos) {
            try { await api.uploadPhoto(id, game.wines[photo.index].roundId, photo.blob); } catch { photoFailures++; }
          }
        } catch { photoFailures = photos.length; }
      }
      if (mounted.current) navigate(`/host/${id}`, { state: { created: true, photoFailures } });
    } catch (error) {
      if (mounted.current) setErrors([gameErrorMessage(error)]);
    } finally {
      submitting.current = false;
      if (mounted.current) setPending(false);
    }
  }

  return <section className="game-section" aria-labelledby="create-title">
    <h2 id="create-title">Új kóstoló</h2>
    <p>Add meg a kóstoló adatait és a borokat a tervezett sorrendben. A fotó kivételével minden mező kötelező.</p>
    <form onSubmit={(event) => void submit(event)} noValidate>
      <fieldset className="game-fields" disabled={pending !== false}>
        <legend className="sr-only">A kóstoló adatai</legend>
        <label>Kóstoló címe<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required autoComplete="off" /></label>
        <div className="game-settings">
          <label>Kóstolási idő boronként (másodperc)<input type="number" min="30" max="1800" step="1" inputMode="numeric" value={seconds} onChange={(event) => setSeconds(event.target.value)} required /></label>
          <label>Felfedés ennyi bor után<input type="number" min="1" max="12" step="1" inputMode="numeric" value={reveal} onChange={(event) => setReveal(event.target.value)} required /></label>
        </div>
        <p className="game-hint">A felfedést később te indítod. Az utolsó blokk kevesebb bort is tartalmazhat.</p>
        <h3>Borok</h3>
        <p id="wine-privacy" className="game-hint">A borok adatait és fotóit csak te láthatod a felfedésig.</p>
        {wines.map((wine, index) => <fieldset className="wine-fields" key={wine.id} aria-describedby="wine-privacy">
          <legend>{index+1}. tétel</legend>
          <label>Bor neve és évjárata<input value={wine.name} onChange={(event) => updateWine(wine.id, 'name', event.target.value)} maxLength={200} required autoComplete="off" /></label>
          <div className="game-settings">
            <label>Valódi palackár (Ft / 0,75 l)<input type="number" inputMode="numeric" min="1" max="1000000" step="1" value={wine.price} onChange={(event) => updateWine(wine.id, 'price', event.target.value)} required /></label>
            <label>Valódi alkoholfok (% vol)<input type="text" inputMode="decimal" placeholder="pl. 13,5" value={wine.alcohol} onChange={(event) => updateWine(wine.id, 'alcohol', event.target.value)} required /></label>
          </div>
          <div className="wine-photo-pick">
            <WinePhoto src={wine.photo?.url ?? null} alt={`${wine.name || `${index+1}. tétel`} – kiválasztott borfotó`} number={String(index+1).padStart(2, '0')} />
            <div>
              <div className="upload-control">
                <label htmlFor={`new-wine-photo-${wine.id}`}>{wine.photo ? 'Fotó cseréje' : 'Fotó hozzáadása'}<span className="sr-only"> · {index+1}. tétel</span></label>
                <input id={`new-wine-photo-${wine.id}`} type="file" accept="image/*" aria-describedby={`new-wine-photo-${wine.id}-message`} onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = '';
                  if (file) void pickPhoto(wine.id, file);
                }} />
              </div>
              {wine.photo && <div className="photo-actions"><button type="button" className="button-secondary" onClick={() => setPhoto(wine.id, null, 'Fotó eltávolítva.')}>Fotó eltávolítása<span className="sr-only"> · {index+1}. tétel</span></button></div>}
              <p className="small-note" id={`new-wine-photo-${wine.id}-message`} aria-live="polite">{wine.photoMessage || 'Nem kötelező. A címkefotó a felfedésnél és az eredményeknél jelenik meg.'}</p>
            </div>
          </div>
          <div className="wine-actions">
            <button type="button" className="button-secondary" disabled={index === 0} aria-label={`${index+1}. tétel előrébb`} onClick={() => moveWine(index, -1)}>Előrébb</button>
            <button type="button" className="button-secondary" disabled={index === wines.length-1} aria-label={`${index+1}. tétel hátrébb`} onClick={() => moveWine(index, 1)}>Hátrébb</button>
            <button type="button" className="button-secondary" disabled={wines.length === 1} aria-label={`${index+1}. tétel törlése`} onClick={() => removeWine(wine.id)}>Törlés</button>
          </div>
        </fieldset>)}
        <button type="button" className="button-secondary" disabled={wines.length >= 12} onClick={() => setWines((current) => [...current, emptyWine()])}>Bor hozzáadása ({wines.length}/12)</button>
      </fieldset>
      {errors.length > 0 && <div className="auth-message" role="alert" ref={errorBox} tabIndex={-1}>
        <p>A kóstoló mentését nem igazoltuk vissza.</p><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul>
        <p>Hálózati hiba után ugyanazokkal az adatokkal újrapróbálhatod a mentést.</p>
      </div>}
      <p className="game-hint">A kóstolót elmentjük. Ezután megnyithatod a várót és meghívhatod a résztvevőket. Az online körök indítása még készül.</p>
      <button type="submit" className="button-primary" disabled={pending !== false}>{pending ? 'Kóstoló mentése…' : 'Kóstoló létrehozása'}</button>
      {pending && <p role="status">{pending === 'photos' ? 'A kóstoló létrejött, fotók feltöltése…' : 'Várakozás a szerver visszaigazolására…'}</p>}
    </form>
  </section>;
}
