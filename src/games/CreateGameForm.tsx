import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { gameErrorMessage } from './api';
import { parseAlcohol, validateGameInput } from './model';
import type { GamesApi } from './model';

type WineFields = { id: string; name: string; price: string; alcohol: string };
const emptyWine = (): WineFields => ({ id: crypto.randomUUID(), name: '', price: '', alcohol: '' });
export function CreateGameForm({ api }: { api: GamesApi }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [seconds, setSeconds] = useState('120');
  const [reveal, setReveal] = useState('2');
  const [wines, setWines] = useState<WineFields[]>(() => [emptyWine()]);
  const [requestId] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const mounted = useRef(true);
  const submitting = useRef(false);
  const errorBox = useRef<HTMLDivElement>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (errors.length) errorBox.current?.focus(); }, [errors]);

  function updateWine(id: string, field: 'name' | 'price' | 'alcohol', value: string) {
    setWines((current) => current.map((wine) => wine.id === id ? { ...wine, [field]: value } : wine));
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
    setPending(true);
    try {
      const id = await api.create(input, requestId);
      if (mounted.current) navigate(`/host/${id}`, { state: { created: true } });
    } catch (error) {
      if (mounted.current) setErrors([gameErrorMessage(error)]);
    } finally {
      submitting.current = false;
      if (mounted.current) setPending(false);
    }
  }

  return <section className="game-section" aria-labelledby="create-title">
    <h2 id="create-title">Új kóstoló</h2>
    <p>Add meg a kóstoló adatait és a borokat a tervezett sorrendben. Minden mező kötelező.</p>
    <form onSubmit={(event) => void submit(event)} noValidate>
      <fieldset className="game-fields" disabled={pending}>
        <legend className="sr-only">A kóstoló adatai</legend>
        <label>Kóstoló címe<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required autoComplete="off" /></label>
        <div className="game-settings">
          <label>Kóstolási idő boronként (másodperc)<input type="number" min="30" max="1800" step="1" inputMode="numeric" value={seconds} onChange={(event) => setSeconds(event.target.value)} required /></label>
          <label>Felfedés ennyi bor után<input type="number" min="1" max="12" step="1" inputMode="numeric" value={reveal} onChange={(event) => setReveal(event.target.value)} required /></label>
        </div>
        <p className="game-hint">A felfedést később te indítod. Az utolsó blokk kevesebb bort is tartalmazhat.</p>
        <h3>Borok</h3>
        <p id="wine-privacy" className="game-hint">A borok adatait csak te láthatod a felfedésig.</p>
        {wines.map((wine, index) => <fieldset className="wine-fields" key={wine.id} aria-describedby="wine-privacy">
          <legend>{index+1}. tétel</legend>
          <label>Bor neve és évjárata<input value={wine.name} onChange={(event) => updateWine(wine.id, 'name', event.target.value)} maxLength={200} required autoComplete="off" /></label>
          <div className="game-settings">
            <label>Valódi palackár (Ft / 0,75 l)<input type="number" inputMode="numeric" min="1" max="1000000" step="1" value={wine.price} onChange={(event) => updateWine(wine.id, 'price', event.target.value)} required /></label>
            <label>Valódi alkoholfok (% vol)<input type="text" inputMode="decimal" placeholder="pl. 13,5" value={wine.alcohol} onChange={(event) => updateWine(wine.id, 'alcohol', event.target.value)} required /></label>
          </div>
          <div className="wine-actions">
            <button type="button" className="button-secondary" disabled={index === 0} aria-label={`${index+1}. tétel előrébb`} onClick={() => moveWine(index, -1)}>Előrébb</button>
            <button type="button" className="button-secondary" disabled={index === wines.length-1} aria-label={`${index+1}. tétel hátrébb`} onClick={() => moveWine(index, 1)}>Hátrébb</button>
            <button type="button" className="button-secondary" disabled={wines.length === 1} aria-label={`${index+1}. tétel törlése`} onClick={() => setWines((current) => current.filter((item) => item.id !== wine.id))}>Törlés</button>
          </div>
        </fieldset>)}
        <button type="button" className="button-secondary" disabled={wines.length >= 12} onClick={() => setWines((current) => [...current, emptyWine()])}>Bor hozzáadása ({wines.length}/12)</button>
      </fieldset>
      {errors.length > 0 && <div className="auth-message" role="alert" ref={errorBox} tabIndex={-1}>
        <p>A kóstoló mentését nem igazoltuk vissza.</p><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul>
        <p>Hálózati hiba után ugyanazokkal az adatokkal újrapróbálhatod a mentést.</p>
      </div>}
      <p className="game-hint">A kóstolót elmentjük. Ezután megnyithatod a várót és meghívhatod a résztvevőket. Az online körök indítása még készül.</p>
      <button type="submit" className="button-primary" disabled={pending}>{pending ? 'Kóstoló mentése…' : 'Kóstoló létrehozása'}</button>
      {pending && <p role="status">Várakozás a szerver visszaigazolására…</p>}
    </form>
  </section>;
}
