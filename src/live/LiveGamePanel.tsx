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
import type { PresenceView } from '../lobby/presence';
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
  // During a round the host's submission list also carries presence, so the separate roster would repeat it.
  const roundRoster = !presentation && snapshot?.role === 'host' && !!snapshot.submissions;
  return <LobbyView state={state} refresh={refresh} showTitle={showTitle} activeRound={!!(snapshot?.round || snapshot?.pause || snapshot?.revealCard)} presence={presence} showRoster={!roundRoster}>
    {snapshot && <RoundPanel key={`${snapshot.role}:${snapshot.selfParticipantId ?? 'host'}:${snapshot.round?.id ?? 'lobby'}`}
      api={api} snapshot={snapshot} refresh={refresh} presentation={presentation}
      available={!state.stale && state.connection !== 'offline'} />}
    {snapshot && <TastingExtras api={api} snapshot={snapshot} refresh={refresh} presentation={presentation} presence={presence}
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
  const accepting = open || (round.lateEdits && snapshot.game.status === 'tasting' && round.status === 'open' && round.canSubmit);
  const share = open && round.closesAt !== null ? timeShare(snapshot, round.openedAt, round.closesAt, now) : 0;
  const urgent = open && round.closesAt !== null && seconds <= 10;
  return <section className={`live-round${snapshot.role === 'player' ? ' live-round-player' : ''}`} aria-label="Aktuális kör">
    <div className={`live-round-heading${urgent ? ' is-urgent' : ''}`}>
      <div><p className="eyebrow">AKTUÁLIS TÉTEL</p><h3>{String(round.position).padStart(2, '0')}. tétel</h3></div>
      {round.closesAt === null ? <span className="small-note">Időkorlát nélkül</span> : <span className="live-timer" role="timer" aria-label="Hátralévő idő">
        {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span>}
      {round.closesAt !== null && <span className="live-timer-bar" aria-hidden="true"><span style={{ transform: `scaleX(${share})` }} /></span>}
    </div>
    <p>{accepting ? 'A bor neve és valódi adatai a felfedésig rejtve maradnak.' : 'A kör már nem fogad tippeket. Várd meg a játékmester következő lépését.'}</p>
    {snapshot.role === 'player'
      ? <LiveRatingForm api={api} snapshot={snapshot} refresh={refresh}
          enabled={available && round.canSubmit} />
      : <p className="small-note">{open ? 'A játékosok a határidőig módosíthatják a tippjüket.'
        : round.lateEdits ? 'A játékosok a lejárt idő után is módosíthatják a tippjüket, amíg a következő lépést el nem indítod.'
        : 'A lenti vezérlőn indíthatod a mentett menet következő kártyáját.'}</p>}
  </section>;
}
/** Display-only share of the round still left; the server alone decides when it closes. */
function timeShare(snapshot: GameSnapshot, openedAt: string, closesAt: string, now: number) {
  const total = Date.parse(closesAt) - Date.parse(openedAt);
  const left = Date.parse(closesAt) - snapshot.serverTime - Math.max(0, now - snapshot.receivedAt);
  return total > 0 ? Math.min(1, Math.max(0, left / total)) : 0;
}
function TastingExtras({ api, snapshot, refresh, available, presentation, presence }: {
  api: LiveApi; snapshot: GameSnapshot; refresh: () => Promise<void>; available: boolean; presentation: boolean; presence: PresenceView | null;
}) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => { const timer = setInterval(() => setNow(performance.now()), 1000); return () => clearInterval(timer); }, []);
  const pause = snapshot.pause;
  const remaining = pause?.endsAt ? Math.max(0, Math.ceil((Date.parse(pause.endsAt)-snapshot.serverTime-Math.max(0,now-snapshot.receivedAt))/1000)) : null;
  const guessing = !presentation && snapshot.role === 'player' && !!snapshot.round && snapshot.round.status !== 'revealed';
  return <>
    {pause && <section className="live-break" aria-label="Szünet">
      <p className="eyebrow">SZÜNET / ÁTVEZETÉS</p><h3>{pause.title}</h3>
      <p className="live-break-message">{pause.message}</p>
      {remaining !== null && <p role="timer" aria-label="Szünetből hátralévő idő" className="live-timer">{String(Math.floor(remaining/60)).padStart(2,'0')}:{String(remaining%60).padStart(2,'0')}</p>}
      <p className="small-note">A folytatást a játékmester indítja.</p>
    </section>}
    {snapshot.revealCard && !presentation && <section className="live-break live-break-reveal" aria-label="Felfedés">
      <p className="eyebrow">FELFEDÉS / BEMUTATÓ</p><h3>{snapshot.revealCard.title}</h3>
      <p className="live-break-message">{snapshot.revealCard.message}</p>
      <p className="small-note">{snapshot.revealCard.roundIds.length} bemutatott bor · A folytatást a játékmester indítja.</p>
    </section>}
    {snapshot.game.status === 'finished' && !snapshot.results && <h3>A kóstoló befejeződött.</h3>}
    {snapshot.role === 'host' && !presentation && snapshot.submissions && <SubmissionList submissions={snapshot.submissions} presence={presence} />}
    {snapshot.role === 'host' && api.schedule && <HostControls compact={presentation} api={api.schedule} snapshot={snapshot} refresh={refresh} available={available} secondsLeft={secondsLeft(snapshot,now)} />}
    {snapshot.results && snapshot.role === 'host' && !presentation && <p>
      <a className="button-secondary" href={`/present/${snapshot.game.id}`} target="_blank" rel="noopener">Eredmények kivetítése</a>
    </p>}
    {snapshot.results && !guessing && <details className="live-results" open={presentation || snapshot.game.status === 'reveal' || snapshot.game.status === 'finished'}>
      <summary>Eredmények ({snapshot.results.revealedCount} bor)</summary>
      <ResultsPanel key={snapshot.revealCard?.id ?? snapshot.results.revealedCount} roundIds={snapshot.revealCard?.roundIds} intro={presentation ? snapshot.revealCard : undefined} results={snapshot.results} gameId={snapshot.game.id} selfId={snapshot.selfParticipantId} photos={api.resultPhotos} presentation={presentation} />
    </details>}
    {!snapshot.results && !guessing && !!snapshot.revealed?.length && <details open={snapshot.game.status === 'reveal' || snapshot.game.status === 'finished'}>
      <summary>Felfedett borok ({snapshot.revealed.length})</summary><ol className="live-revealed">
        {snapshot.revealed.map(w => <li key={w.id}><h3>{String(w.position).padStart(2,'0')}. {w.name}</h3>
          <RevealedWinePhoto api={api} gameId={snapshot.game.id} wine={w} />
          <p>{w.priceHuf.toLocaleString('hu-HU')} Ft · {(w.alcoholTenths/10).toLocaleString('hu-HU')}% vol</p></li>)}
      </ol></details>}
  </>;
}
function SubmissionList({ submissions, presence }: { submissions: NonNullable<GameSnapshot['submissions']>; presence: PresenceView | null }) {
  const submitted = submissions.filter(item => item.submitted).length;
  const live = presence?.status === 'live';
  const online = live ? submissions.filter(item => presence.online.has(item.id)).length : 0;
  return <section className="submission-list" aria-label="Játékosok ennél a bornál">
    <h3>Játékosok ennél a bornál</h3>
    <p className="small-note">{submitted} / {submissions.length} játékos adott le tippet{live ? ` · ${online} bent van most` : ''}. A tipp tartalma rejtve marad.</p>
    <ul>{submissions.map(item => {
      const isOnline = live && presence.online.has(item.id);
      return <li key={item.id} className={[live && (isOnline ? 'is-online' : 'is-away'), item.submitted && 'is-submitted'].filter(Boolean).join(' ') || undefined}>
        <span className="submission-seat">#{String(item.seat).padStart(2, '0')}</span>
        <span className="submission-name">{item.nickname}</span>
        {live && <span className="submission-presence">{isOnline ? 'Online' : 'Offline'}</span>}
        <strong className="submission-state">{item.submitted ? 'Leadta' : 'Még nincs tipp'}</strong>
      </li>;
    })}</ul>
    {presence?.status === 'unavailable' && <p className="small-note">Az online jelenlét most nem látszik; a tippek állapota friss.</p>}
  </section>;
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
    if (busy.current || !enabled || (secondsLeft(snapshot) <= 0 && !round.lateEdits)) return;
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
    {saved && <div className="live-saved" role="status" key={saved.submittedAt}>
      <svg className="live-saved-check" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      <div><strong>A szerver által mentett tipped</strong>
        <p>{priceBucketLabel(saved.priceBucket)} · {formatAlcohol(saved.alcoholTenths)}% vol · Tetszés: {saved.liking}/10</p></div>
    </div>}
    {round.eligible && <form onSubmit={(event) => void submit(event)} noValidate className="live-rating-form">
      <fieldset disabled={!enabled || pending}>
        <legend>A te tipped</legend>
        <p className="small-note">Minden helyes tipp 1 pont: árkategória, alkoholfok és minden kérdés. A tetszés nem pontoz.</p>
        <RatingFields value={value} onChange={setDraft} />
        {round.questions?.map(q=><fieldset className="custom-question" key={q.id}>
          <legend><CategoryIcon category="question" />{q.prompt}</legend>
          <p className="small-note">Egy választ jelölj meg. Találat esetén 1 pont; a felfedésnél látszik.</p>
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
