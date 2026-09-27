import { QuestionEditor } from '../questions/QuestionEditor';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { maxWines } from '../domain/game';
import { WinePhoto } from '../ui/WinePhoto';
import { gameErrorMessage } from './api';
import type { CreateEntryDraft, CreateGameDraft } from './createGameDraft';
import { parseAlcohol, validateGameInput } from './model';
import type { GamesApi, InitialStep } from './model';
import { prepareWinePhoto, WinePhotoError } from './winePhoto';

type PickedPhoto = { blob: Blob; url: string };
type WineFields = Extract<CreateEntryDraft, { kind: 'wine' }> & { photo: PickedPhoto | null; photoMessage: string };
type CardFields = Extract<CreateEntryDraft, { kind: 'break' | 'reveal' }>;
type Entry = WineFields | CardFields;
const emptyWine = (): WineFields => ({ questions: [], kind: 'wine', id: crypto.randomUUID(), name: '', price: '', alcohol: '', photo: null, photoMessage: '', sourcePhoto: null });

function entriesFromDraft(draft: CreateGameDraft | undefined): Entry[] {
  if (!draft?.entries.length) return [emptyWine()];
  return draft.entries.map((entry) => entry.kind === 'wine'
    ? { ...entry, photo: null, photoMessage: entry.sourcePhoto ? 'A meglévő fotó az új kóstolóval együtt mentődik.' : '' }
    : { ...entry });
}

function showEntry(id: string) {
  requestAnimationFrame(() => document.getElementById(`entry-${id}`)?.scrollIntoView({ block: 'nearest' }));
}

function DraftWinePhoto({ api, wine, index }: { api: GamesApi; wine: WineFields; index: number }) {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const source = wine.sourcePhoto;
  useEffect(() => {
    if (!source || wine.photo) return;
    let active = true;
    api.photoUrl(source.gameId, source.roundId).then((url) => { if (active) setCopiedUrl(url); }, () => { if (active) setCopiedUrl(null); });
    return () => { active = false; };
  }, [api, source, wine.photo]);
  return <WinePhoto src={wine.photo?.url ?? copiedUrl} alt={`${wine.name || `${index + 1}. tétel`} – kiválasztott borfotó`} number={String(index + 1).padStart(2, '0')} />;
}

export function CreateGameForm({ api, draft }: { api: GamesApi; draft?: CreateGameDraft }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(draft?.title ?? '');
  const [timed, setTimed] = useState(draft?.timed ?? true);
  const [seconds, setSeconds] = useState(draft?.seconds ?? '120');
  const [entries, setEntries] = useState<Entry[]>(() => entriesFromDraft(draft));
  const wines = entries.filter((e): e is WineFields => e.kind === 'wine');
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
    setEntries((current) => current.map((wine) => wine.kind === 'wine' && wine.id === id ? { ...wine, [field]: value } : wine));
  }
  function setPhoto(id: string, photo: PickedPhoto | null, photoMessage: string) {
    setEntries((current) => current.map((wine) => {
      if (wine.kind !== 'wine' || wine.id !== id) return wine;
      if (wine.photo && wine.photo !== photo) { URL.revokeObjectURL(wine.photo.url); photoUrls.current.delete(wine.photo.url); }
      return { ...wine, photo, photoMessage, sourcePhoto: null };
    }));
  }
  async function pickPhoto(id: string, file: File) {
    setEntries((current) => current.map((wine) => wine.kind === 'wine' && wine.id === id ? { ...wine, photoMessage: 'Fotó előkészítése…' } : wine));
    try {
      const blob = await prepareWinePhoto(file);
      if (!mounted.current) return;
      const url = URL.createObjectURL(blob);
      photoUrls.current.add(url);
      setPhoto(id, { blob, url }, 'A fotó a kóstoló létrehozásakor töltődik fel.');
    } catch (error) {
      if (!mounted.current) return;
      const message = error instanceof WinePhotoError ? error.message : 'A kép nem dolgozható fel. Válassz másik fájlt.';
      setEntries((current) => current.map((wine) => wine.kind === 'wine' && wine.id === id ? { ...wine, photoMessage: message } : wine));
    }
  }
  function removeWine(id: string) {
    setEntries((current) => current.filter((wine) => {
      if (wine.kind === 'wine' && wine.id === id && wine.photo) { URL.revokeObjectURL(wine.photo.url); photoUrls.current.delete(wine.photo.url); }
      return wine.id !== id;
    }));
  }
  function moveStep(index: number, offset: number) {
    setEntries((current) => {
      const next = [...current];
      [next[index], next[index+offset]] = [next[index+offset], next[index]];
      return next;
    });
  }
  function addCard(kind: CardFields['kind']) {
    const id = crypto.randomUUID();
    setEntries(current => [...current, {kind,id,title:kind === 'break' ? 'Szünet' : 'Felfedés',message:'',seconds:kind === 'break' ? 300 : 0,targets:[]}]);
    showEntry(id);
  }
  function addWine() {
    const wine = emptyWine();
    setEntries(current => [...current, wine]);
    showEntry(wine.id);
  }
  function patchCard(id: string, value: Partial<CardFields>) {
    setEntries(current => current.map(e => e.id === id && e.kind !== 'wine' ? {...e,...value} : e));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    const steps: InitialStep[] = entries.map(e => e.kind === 'wine' ? {kind:'wine',wine_index:wines.findIndex(w=>w.id===e.id)}
      : {kind:e.kind,title:e.title,message:e.message,seconds:e.seconds,wine_indexes:e.targets.map(id=>wines.findIndex(w=>w.id===id))});
    const input = { ...(entries.some(e=>e.kind !== 'wine') ? {steps} : {}), title, roundSeconds: timed ? Number(seconds) : 0, revealEvery: 2,
      wines: wines.map((wine) => ({ ...(wine.questions.length ? {questions:wine.questions}:{}), name: wine.name, priceHuf: wine.price.trim() ? Number(wine.price) : NaN,
        alcoholTenths: parseAlcohol(wine.alcohol) })) };
    const invalid = validateGameInput(input);
    if (entries.length > 60) invalid.push('Legfeljebb 60 lépés adható hozzá.');
    entries.forEach((e,i) => {
      if (e.kind === 'wine') return;
      if (!e.title.trim() || e.title.trim().length > 100 || e.message.length > 2000) invalid.push(`${i+1}. lépés: adj meg legfeljebb 100 karakteres címet és 2000 karakteres szöveget.`);
      if (e.kind === 'break' && (!Number.isInteger(e.seconds) || e.seconds < 0 || e.seconds > 7200)) invalid.push(`${i+1}. lépés: a szünet 0–7200 egész másodperc lehet.`);
      if (e.kind === 'reveal' && (!e.targets.length || e.targets.some(id=>!entries.slice(0,i).some(w=>w.kind==='wine' && w.id===id)))) invalid.push(`${i+1}. lépés: válassz legalább egy, a felfedés előtt szereplő bort. Ellenőrizd a kijelöléseket és a sorrendet.`);
    });
    setErrors(invalid);
    if (invalid.length) return;
    submitting.current = true;
    setPending('game');
    try {
      const id = await api.create(input, requestId);
      const photos = wines.flatMap((wine, index) => wine.photo ? [{ index, blob: wine.photo.blob }] : []);
      const copies = wines.flatMap((wine, index) => !wine.photo && wine.sourcePhoto ? [{ index, source: wine.sourcePhoto }] : []);
      let photoFailures = 0;
      if (photos.length || copies.length) {
        if (mounted.current) setPending('photos');
        try {
          const game = await api.get(id);
          for (const photo of photos) {
            try { await api.uploadPhoto(id, game.wines[photo.index].roundId, photo.blob); } catch { photoFailures++; }
          }
          for (const copy of copies) {
            try { await api.copyPhoto(copy.source.gameId, copy.source.roundId, id, game.wines[copy.index].roundId); } catch { photoFailures++; }
          }
        } catch { photoFailures = photos.length + copies.length; }
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
    <p>Add meg a boradatokat, és állítsd össze a kóstoló menetét. A fotók és a kártyák kísérőszövege nem kötelező.</p>
    <form onSubmit={(event) => void submit(event)} noValidate>
      <fieldset className="game-fields" disabled={pending !== false}>
        <legend className="sr-only">A kóstoló adatai</legend>
        <label>Kóstoló címe<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required autoComplete="off" /></label>
        <div className="game-settings">
          <label className="timer-toggle"><input type="checkbox" checked={timed} onChange={e => setTimed(e.target.checked)} />Időkorlát használata</label>
          {timed && <label>Kóstolási idő boronként (másodperc)<input type="number" min="30" max="1800" step="1" inputMode="numeric" value={seconds} onChange={(event) => setSeconds(event.target.value)} required /></label>}

        </div>
        <p className="game-hint">A borokat, szüneteket és felfedéseket már itt sorba rendezheted. A felfedéshez egy vagy több, előtte szereplő bort válassz.</p>
        <h3>A kóstoló menete</h3>
        <div className="schedule-actions schedule-add-bar">
          <button type="button" className="button-secondary" disabled={wines.length >= maxWines || entries.length >= 60} onClick={addWine}>Bor hozzáadása</button>
          <button type="button" className="button-secondary" disabled={entries.length >= 60} onClick={() => addCard('break')}>Szünet hozzáadása</button>
          <button type="button" className="button-secondary" disabled={entries.length >= 60} onClick={() => addCard('reveal')}>Felfedés hozzáadása</button>
        </div>
        <p id="wine-privacy" className="game-hint">A borok adatait és fotóit csak te láthatod a felfedésig.</p>
        {entries.map((entry, stepIndex) => {
          if (entry.kind !== 'wine') return <fieldset id={`entry-${entry.id}`} key={entry.id} className={`wine-fields schedule-step-${entry.kind}`}>
            <legend>{stepIndex+1}. lépés · {entry.kind === 'break' ? 'Szünet' : 'Felfedés'}</legend>
            <label>{entry.kind === 'break' ? 'Szünet címe' : 'Felfedés címe'}<input required maxLength={100} value={entry.title} onChange={e=>patchCard(entry.id,{title:e.target.value})} /></label>
            <label>Játékosoknak megjelenő szöveg<textarea rows={3} maxLength={2000} value={entry.message} onChange={e=>patchCard(entry.id,{message:e.target.value})} /></label>
            {entry.kind === 'break' ? <label>Szünet hossza (másodperc, 0 = óra nélkül)<input type="number" min={0} max={7200} step={1} value={Number.isFinite(entry.seconds)?entry.seconds:''} onChange={e=>patchCard(entry.id,{seconds:e.target.value===''?NaN:Number(e.target.value)})} /></label>
              : <fieldset className="reveal-targets"><legend>Bemutatandó borok</legend>
                <p className="small-note">Jelölj ki egy vagy több korábbi bort.</p>
                {entries.slice(0,stepIndex).filter((w): w is WineFields=>w.kind==='wine').map(w=><label key={w.id} className="timer-toggle">
                  <input type="checkbox" checked={entry.targets.includes(w.id)} onChange={e=>patchCard(entry.id,{targets:e.target.checked?[...entry.targets,w.id]:entry.targets.filter(id=>id!==w.id)})} />{wines.findIndex(x=>x.id===w.id)+1}. {w.name || 'Névtelen bor'}
                </label>)}
                {entry.targets.filter(id=>!entries.slice(0,stepIndex).some(w=>w.kind==='wine' && w.id===id)).map(id=><label key={id} className="timer-toggle">
                  <input type="checkbox" checked onChange={()=>patchCard(entry.id,{targets:entry.targets.filter(x=>x!==id)})} />Érvénytelen kijelölés — töröld vagy állítsd helyre a sorrendet
                </label>)}
              </fieldset>}
            <div className="wine-actions">
              <button type="button" className="button-secondary" disabled={stepIndex===0} aria-label={`${stepIndex+1}. lépés előrébb`} onClick={()=>moveStep(stepIndex,-1)}>Előrébb</button>
              <button type="button" className="button-secondary" disabled={stepIndex===entries.length-1} aria-label={`${stepIndex+1}. lépés hátrébb`} onClick={()=>moveStep(stepIndex,1)}>Hátrébb</button>
              <button type="button" className="button-secondary" aria-label={`${stepIndex+1}. lépés törlése`} onClick={()=>setEntries(current=>current.filter(e=>e.id!==entry.id))}>Törlés</button>
            </div>
          </fieldset>;
          const wine=entry,index=wines.findIndex(w=>w.id===entry.id);
          const keptPhoto = Boolean(wine.photo || wine.sourcePhoto);
          return <fieldset id={`entry-${wine.id}`} className="wine-fields" key={wine.id} aria-describedby="wine-privacy">
          <legend>{index+1}. tétel</legend>
          <label>Bor neve és évjárata<input value={wine.name} onChange={(event) => updateWine(wine.id, 'name', event.target.value)} maxLength={200} required autoComplete="off" /></label>
          <div className="game-settings">
            <label>Valódi palackár (Ft / 0,75 l)<input type="number" inputMode="numeric" min="1" max="1000000" step="1" value={wine.price} onChange={(event) => updateWine(wine.id, 'price', event.target.value)} required /></label>
            <label>Valódi alkoholfok (% vol)<input type="text" inputMode="decimal" placeholder="pl. 13,5" value={wine.alcohol} onChange={(event) => updateWine(wine.id, 'alcohol', event.target.value)} required /></label>
          </div>
          <QuestionEditor questions={wine.questions} onChange={questions=>setEntries(current=>current.map(e=>e.id===wine.id && e.kind==='wine'?{...e,questions}:e))} />
          <div className="wine-photo-pick">
            <DraftWinePhoto api={api} wine={wine} index={index} />
            <div>
              <div className="upload-control">
                <label htmlFor={`new-wine-photo-${wine.id}`}>{keptPhoto ? 'Fotó cseréje' : 'Fotó hozzáadása'}<span className="sr-only"> · {index+1}. tétel</span></label>
                <input id={`new-wine-photo-${wine.id}`} type="file" accept="image/*" aria-describedby={`new-wine-photo-${wine.id}-message`} onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = '';
                  if (file) void pickPhoto(wine.id, file);
                }} />
              </div>
              {keptPhoto && <div className="photo-actions"><button type="button" className="button-secondary" onClick={() => setPhoto(wine.id, null, 'Fotó eltávolítva.')}>Fotó eltávolítása<span className="sr-only"> · {index+1}. tétel</span></button></div>}
              <p className="small-note" id={`new-wine-photo-${wine.id}-message`} aria-live="polite">{wine.photoMessage || 'Nem kötelező. A címkefotó a felfedésnél és az eredményeknél jelenik meg.'}</p>
            </div>
          </div>
          <div className="wine-actions">
            <button type="button" className="button-secondary" disabled={stepIndex === 0} aria-label={`${index+1}. tétel előrébb`} onClick={() => moveStep(stepIndex, -1)}>Előrébb</button>
            <button type="button" className="button-secondary" disabled={stepIndex === entries.length-1} aria-label={`${index+1}. tétel hátrébb`} onClick={() => moveStep(stepIndex, 1)}>Hátrébb</button>
            <button type="button" className="button-secondary" disabled={wines.length === 1} aria-label={`${index+1}. tétel törlése`} onClick={() => removeWine(wine.id)}>Törlés</button>
          </div>
        </fieldset>;})}

      </fieldset>
      {errors.length > 0 && <div className="auth-message" role="alert" ref={errorBox} tabIndex={-1}>
        <p>A kóstoló mentését nem igazoltuk vissza.</p><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul>
        <p>Hálózati hiba után ugyanazokkal az adatokkal újrapróbálhatod a mentést.</p>
      </div>}
      <p className="game-hint">A teljes menetet együtt mentjük: borok, szünetek és felfedések. Ezután megnyithatod a várót.</p>
      <button type="submit" className="button-primary" disabled={pending !== false}>{pending ? 'Kóstoló mentése…' : 'Kóstoló létrehozása'}</button>
      {pending && <p role="status">{pending === 'photos' ? 'A kóstoló létrejött, fotók feltöltése…' : 'Várakozás a szerver visszaigazolására…'}</p>}
    </form>
  </section>;
}
