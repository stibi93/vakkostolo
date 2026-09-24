import { CategoryIcon } from '../rating/CategoryIcon';
import { useEffect, useRef, useState } from 'react';
import { ResultsPanel } from '../results/ResultsPanel';
import { RevealedWinePhoto } from './RevealedWinePhoto';
import { HostControls } from '../schedule/HostControls';
import { newRequestId } from '../schedule/model';
import type { FormEvent } from 'react';
import type { GameStatus, Rating } from '../domain/game';
import { priceBucketLabel, validateRating } from '../domain/game';
import { lobbyErrorMessage } from '../lobby/api';
import { LobbyView } from '../lobby/LobbyPanel';
import { usePresence } from '../lobby/usePresence';
import { useSnapshot } from '../lobby/useSnapshot';
import { RatingFields } from '../rating/RatingFields';
import { draftFromRating, formatAlcohol, ratingFromDraft } from '../rating/draft';
import type { RatingDraft } from '../rating/draft';
import type { GameSnapshot, LiveApi, SavedRating } from './model';
import { secondsLeft } from './model';
import './live.css';

export function LiveGamePanel({ api, gameId, showTitle = true, presentation = false, onStatusChange, onVersionChange }: {
  api: LiveApi; gameId: string; showTitle?: boolean; presentation?: boolean; onStatusChange?: (status: GameStatus) => void; onVersionChange?: (version: number) => void;
}) {
  const { state, refresh } = useSnapshot(api, gameId);
  const snapshot = state.snapshot;
  const presence = usePresence(api.presence, gameId, snapshot);
  useEffect(() => { if (snapshot) onStatusChange?.(snapshot.game.status); }, [snapshot, onStatusChange]);
  useEffect(() => { if (snapshot) onVersionChange?.(snapshot.game.version); }, [snapshot, onVersionChange]);
  return <LobbyView state={state} refresh={refresh} showTitle={showTitle} activeRound={!!(snapshot?.round || snapshot?.pause || snapshot?.revealCard)} presence={presence}>
    {snapshot && <RoundPanel key={`${snapshot.role}:${snapshot.selfParticipantId ?? 'host'}:${snapshot.round?.id ?? 'lobby'}`}
      api={api} snapshot={snapshot} refresh={refresh} presentation={presentation}
      available={!state.stale && state.connection !== 'offline'} />}
    {snapshot && <TastingExtras api={api} snapshot={snapshot} refresh={refresh} presentation={presentation}
      available={!state.stale && state.connection !== 'offline'} />}
  </LobbyView>;
}
function RoundPanel({ api, snapshot, refresh, available, presentation }: {
  api: LiveApi; snapshot: GameSnapshot; refresh: () => Promise<void>; available: boolean; presentation: boolean;
}) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => { const timer = setInterval(() => setNow(performance.now()), 250); return () => clearInterval(timer); }, []);
  const seconds = snapshot.round?.status === 'open' ? secondsLeft(snapshot, now) : 0;
  const round = snapshot.round;
  if (!round) return snapshot.role === 'host' && snapshot.game.status === 'lobby' && !presentation
    ? <StartRound key={snapshot.game.version} api={api} snapshot={snapshot} refresh={refresh} available={available} /> : null;
  if (round.status === 'revealed') return null;
  const open = snapshot.game.status === 'tasting' && round.status === 'open' && seconds > 0;
  return <section className={`live-round${snapshot.role === 'player' ? ' live-round-player' : ''}`} aria-label="Aktuális kör">
    <div className="live-round-heading">
      <div><p className="eyebrow">AKTUÁLIS TÉTEL</p><h3>{String(round.position).padStart(2, '0')}. tétel</h3></div>
      {round.closesAt === null ? <span className="small-note">Időkorlát nélkül</span> : <span className="live-timer" role="timer" aria-label="Hátralévő idő">
        {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span>}
    </div>
    <p>{open ? 'A bor neve és valódi adatai a felfedésig rejtve maradnak.' : 'A kör már nem fogad tippeket. Várd meg a játékmester következő lépését.'}</p>
    {snapshot.role === 'player'
      ? <LiveRatingForm api={api} snapshot={snapshot} refresh={refresh}
          enabled={available && open && round.canSubmit} />
      : <p className="small-note">{open ? 'A játékosok a határidőig módosíthatják a tippjüket.'
        : 'A lenti vezérlőn indíthatod a mentett menet következő kártyáját.'}</p>}
  </section>;
}
function TastingExtras({ api, snapshot, refresh, available, presentation }: {
  api: LiveApi; snapshot: GameSnapshot; refresh: () => Promise<void>; available: boolean; presentation: boolean;
}) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => { const timer = setInterval(() => setNow(performance.now()), 1000); return () => clearInterval(timer); }, []);
  const pause = snapshot.pause;
  const remaining = pause?.endsAt ? Math.max(0, Math.ceil((Date.parse(pause.endsAt)-snapshot.serverTime-Math.max(0,now-snapshot.receivedAt))/1000)) : null;
  return <>
    {pause && <section className="live-break" aria-label="Szünet">
      <p className="eyebrow">SZÜNET / ÁTVEZETÉS</p><h3>{pause.title}</h3>
      <p className="live-break-message">{pause.message}</p>
      {remaining !== null && <p role="timer" aria-label="Szünetből hátralévő idő" className="live-timer">{String(Math.floor(remaining/60)).padStart(2,'0')}:{String(remaining%60).padStart(2,'0')}</p>}
      <p className="small-note">A folytatást a játékmester indítja.</p>
    </section>}
    {snapshot.revealCard && !presentation && <section className="live-break" aria-label="Felfedés">
      <p className="eyebrow">FELFEDÉS / BEMUTATÓ</p><h3>{snapshot.revealCard.title}</h3>
      <p className="live-break-message">{snapshot.revealCard.message}</p>
      <p className="small-note">{snapshot.revealCard.roundIds.length} bemutatott bor · A folytatást a játékmester indítja.</p>
    </section>}
    {snapshot.game.status === 'finished' && !snapshot.results && <h3>A kóstoló befejeződött.</h3>}
    {snapshot.role === 'host' && !presentation && api.schedule && <HostControls api={api.schedule} snapshot={snapshot} refresh={refresh} available={available} secondsLeft={secondsLeft(snapshot,now)} />}
    {snapshot.results && snapshot.role === 'host' && !presentation && <p>
      <a className="button-secondary" href={`/present/${snapshot.game.id}`} target="_blank" rel="noopener">Eredmények kivetítése</a>
    </p>}
    {snapshot.results && <details className="live-results" open={presentation || snapshot.game.status === 'reveal' || snapshot.game.status === 'finished'}>
      <summary>Eredmények ({snapshot.results.revealedCount} bor)</summary>
      <ResultsPanel key={snapshot.revealCard?.id ?? snapshot.results.revealedCount} roundIds={snapshot.revealCard?.roundIds} intro={presentation ? snapshot.revealCard : undefined} results={snapshot.results} gameId={snapshot.game.id} selfId={snapshot.selfParticipantId} photos={api.resultPhotos} presentation={presentation} />
    </details>}
    {!snapshot.results && !!snapshot.revealed?.length && <details open={snapshot.game.status === 'reveal' || snapshot.game.status === 'finished'}>
      <summary>Felfedett borok ({snapshot.revealed.length})</summary><ol className="live-revealed">
        {snapshot.revealed.map(w => <li key={w.id}><h3>{String(w.position).padStart(2,'0')}. {w.name}</h3>
          <RevealedWinePhoto api={api} gameId={snapshot.game.id} wine={w} />
          <p>{w.priceHuf.toLocaleString('hu-HU')} Ft · {(w.alcoholTenths/10).toLocaleString('hu-HU')}% vol</p></li>)}
      </ol></details>}
  </>;
}
function StartRound({ api, snapshot, refresh, available }: {
  api: LiveApi; snapshot: GameSnapshot; refresh: () => Promise<void>; available: boolean;
}) {
  const [id] = useState(newRequestId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false), mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function start() {
    if (busy.current || !available) return;
    busy.current = true; setPending(true); setError(null);
    try { await api.start(snapshot.game.id, snapshot.game.version, id); }
    catch (error) { if (mounted.current) setError(lobbyErrorMessage(error)); }
    finally { busy.current = false; if (mounted.current) { setPending(false); void refresh(); } }
  }
  return <div className="live-start">
    <p>Ha mindenki készen áll, indítsd el a mentett menet első lépését: a legelső bort vagy szünetet.</p>
    <button className="button-primary" disabled={pending || !available} onClick={() => void start()}>
      {pending ? 'Indítás…' : 'Első kör indítása'}</button>
    {error && <p className="auth-message" role="alert">{error}</p>}
  </div>;
}
function LiveRatingForm({ api, snapshot, refresh, enabled }: {
  api: LiveApi; snapshot: GameSnapshot; refresh: () => Promise<void>; enabled: boolean;
}) {
  const [draft, setDraft] = useState<RatingDraft | null>(null);
  const [answers, setAnswers] = useState<Record<string,string> | null>(null);
  const [ack, setAck] = useState<SavedRating | null>(null);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const busy = useRef(false), mounted = useRef(false), errorBox = useRef<HTMLDivElement>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (errors.length) errorBox.current?.focus(); }, [errors]);
  const saved = ack && (!snapshot.ownRating || Date.parse(ack.submittedAt) >= Date.parse(snapshot.ownRating.submittedAt)) ? ack : snapshot.ownRating;
  const value = draft ?? draftFromRating(saved);
  const round = snapshot.round!;
  const choices = answers ?? saved?.customAnswers ?? {};
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current || !enabled || secondsLeft(snapshot) <= 0) return;
    const rating: Rating = {...ratingFromDraft(value), ...(round.questions?.length ? {customAnswers:choices}:{})};
    const invalid = validateRating(rating);
    if (round.questions?.some(q=>!q.options.some(o=>o.id===choices[q.id]))) invalid.push('Válaszolj minden egyedi kérdésre.');
    setErrors(invalid); if (invalid.length) return;
    busy.current = true; setPending(true);
    try {
      const result = await api.submit(round.id, rating);
      if (mounted.current) { setAck(result); setDraft(null); setAnswers(null); }
    } catch (error) { if (mounted.current) setErrors([lobbyErrorMessage(error)]); }
    finally { busy.current = false; if (mounted.current) { setPending(false); void refresh(); } }
  }
  return <>
    {!round.eligible && <p className="auth-message">Ehhez a körhöz későn érkeztél. A következő tételtől adhatsz tippet.</p>}
    {saved && <div className="live-saved" role="status"><strong>A szerver által mentett tipped</strong>
      <p>{priceBucketLabel(saved.priceBucket)} · {formatAlcohol(saved.alcoholTenths)}% vol · Tetszés: {saved.liking}/10</p>
    </div>}
    {round.eligible && <form onSubmit={(event) => void submit(event)} noValidate className="live-rating-form">
      <fieldset disabled={!enabled || pending}>
        <legend>A te tipped</legend>
        <RatingFields value={value} onChange={setDraft} />
        {round.questions?.map(q=><fieldset className="custom-question" key={q.id}>
          <legend><CategoryIcon category="question" />{q.prompt}</legend>
          <p className="small-note">Egy választ jelölj meg. A találat a felfedésnél látszik; versenypontot nem ad.</p>
          {q.options.map(o=><label className="timer-toggle" key={o.id}><input type="radio" name={`question-${q.id}`} value={o.id} checked={choices[q.id]===o.id} onChange={()=>setAnswers({...choices,[q.id]:o.id})} />{o.label}</label>)}
        </fieldset>)}
        <button className="button-primary" type="submit">{pending ? 'Beküldés…' : saved ? 'Tipp módosítása' : 'Tipp beküldése'}</button>
      </fieldset>
      {(draft || answers) && <p className="small-note">A mezőkben lévő módosítás még nincs visszaigazolva. Újratöltéskor a piszkozat elvész.</p>}
      {!!errors.length && <div className="auth-message" role="alert" tabIndex={-1} ref={errorBox}>{errors.map(text => <p key={text}>{text}</p>)}</div>}
      {!saved && !enabled && <p>Nincs visszaigazolt tipped ehhez a körhöz.</p>}
    </form>}
  </>;
}
