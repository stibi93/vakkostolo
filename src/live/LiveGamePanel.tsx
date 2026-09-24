import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { GameStatus, Rating } from '../domain/game';
import { validateRating } from '../domain/game';
import { parseAlcohol } from '../games/model';
import { lobbyErrorMessage } from '../lobby/api';
import { LobbyView } from '../lobby/LobbyPanel';
import { useSnapshot } from '../lobby/useSnapshot';
import type { GameSnapshot, LiveApi, SavedRating } from './model';
import { secondsLeft } from './model';
import './live.css';

export function LiveGamePanel({ api, gameId, showTitle = true, presentation = false, onStatusChange }: {
  api: LiveApi; gameId: string; showTitle?: boolean; presentation?: boolean; onStatusChange?: (status: GameStatus) => void;
}) {
  const { state, refresh } = useSnapshot(api, gameId);
  const snapshot = state.snapshot;
  useEffect(() => { if (snapshot) onStatusChange?.(snapshot.game.status); }, [snapshot, onStatusChange]);
  return <LobbyView state={state} refresh={refresh} showTitle={showTitle} activeRound={!!snapshot?.round}>
    {snapshot && <RoundPanel key={`${snapshot.role}:${snapshot.selfParticipantId ?? 'host'}:${snapshot.round?.id ?? 'lobby'}`}
      api={api} snapshot={snapshot} refresh={refresh} presentation={presentation}
      available={!state.stale && state.connection !== 'offline'} />}
  </LobbyView>;
}
function RoundPanel({ api, snapshot, refresh, available, presentation }: {
  api: LiveApi; snapshot: GameSnapshot; refresh: () => Promise<void>; available: boolean; presentation: boolean;
}) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => { const timer = setInterval(() => setNow(performance.now()), 250); return () => clearInterval(timer); }, []);
  const seconds = secondsLeft(snapshot, now);
  const round = snapshot.round;
  if (!round) return snapshot.role === 'host' && snapshot.game.status === 'lobby' && !presentation
    ? <StartRound key={snapshot.game.version} api={api} snapshot={snapshot} refresh={refresh} available={available} /> : null;
  const open = snapshot.game.status === 'tasting' && round.status === 'open' && seconds > 0;
  return <section className="live-round" aria-label="Aktuális kör">
    <div className="live-round-heading">
      <div><p className="eyebrow">AKTUÁLIS TÉTEL</p><h3>{String(round.position).padStart(2, '0')}. tétel</h3></div>
      <span className="live-timer" role="timer" aria-label="Hátralévő idő">
        {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span>
    </div>
    <p>{open ? 'A bor neve és valódi adatai a felfedésig rejtve maradnak.' : 'A kör már nem fogad tippeket. Várd meg a játékmester következő lépését.'}</p>
    {snapshot.role === 'player'
      ? <LiveRatingForm api={api} snapshot={snapshot} refresh={refresh}
          enabled={available && open && round.canSubmit} />
      : <p className="small-note">{open ? 'A játékosok a határidőig módosíthatják a tippjüket.'
        : 'A következő kör és a felfedés vezérlése még nem érhető el.'}</p>}
  </section>;
}
// getRandomValues also works on same-network HTTP; randomUUID requires a secure context.
function requestId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
function StartRound({ api, snapshot, refresh, available }: {
  api: LiveApi; snapshot: GameSnapshot; refresh: () => Promise<void>; available: boolean;
}) {
  const [id] = useState(requestId);
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
    <p>Ha mindenki készen áll, indítsd el az első tételt. A beküldési idő azonnal elindul.</p>
    <button className="button-primary" disabled={pending || !available} onClick={() => void start()}>
      {pending ? 'Indítás…' : 'Első kör indítása'}</button>
    {error && <p className="auth-message" role="alert">{error}</p>}
  </div>;
}
type Fields = { price: string; alcohol: string; liking: string };
const fields = (rating: Rating | null): Fields => rating ? { price: String(rating.priceHuf),
  alcohol: String(rating.alcoholTenths / 10).replace('.', ','), liking: String(rating.liking) } : { price: '', alcohol: '', liking: '' };
function LiveRatingForm({ api, snapshot, refresh, enabled }: {
  api: LiveApi; snapshot: GameSnapshot; refresh: () => Promise<void>; enabled: boolean;
}) {
  const [draft, setDraft] = useState<Fields | null>(null);
  const [ack, setAck] = useState<SavedRating | null>(null);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const busy = useRef(false), mounted = useRef(false), errorBox = useRef<HTMLDivElement>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (errors.length) errorBox.current?.focus(); }, [errors]);
  const saved = ack && (!snapshot.ownRating || Date.parse(ack.submittedAt) >= Date.parse(snapshot.ownRating.submittedAt)) ? ack : snapshot.ownRating;
  const value = draft ?? fields(saved);
  const round = snapshot.round!;
  function change(name: keyof Fields, text: string) { setDraft({ ...value, [name]: text }); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current || !enabled || secondsLeft(snapshot) <= 0) return;
    const rating: Rating = { priceHuf: /^\d+$/.test(value.price.trim()) ? Number(value.price) : NaN,
      alcoholTenths: parseAlcohol(value.alcohol), liking: value.liking ? Number(value.liking) : NaN };
    const invalid = validateRating(rating); setErrors(invalid); if (invalid.length) return;
    busy.current = true; setPending(true);
    try {
      const result = await api.submit(round.id, rating);
      if (mounted.current) { setAck(result); setDraft(null); }
    } catch (error) { if (mounted.current) setErrors([lobbyErrorMessage(error)]); }
    finally { busy.current = false; if (mounted.current) { setPending(false); void refresh(); } }
  }
  return <>
    {!round.eligible && <p className="auth-message">Ehhez a körhöz későn érkeztél. A következő tételtől adhatsz tippet.</p>}
    {saved && <div className="live-saved" role="status"><strong>A szerver által mentett tipped</strong>
      <p>{saved.priceHuf.toLocaleString('hu-HU')} Ft · {(saved.alcoholTenths / 10).toLocaleString('hu-HU')}% vol · Tetszés: {saved.liking}/10</p>
    </div>}
    {round.eligible && <form onSubmit={(event) => void submit(event)} noValidate className="live-rating-form">
      <fieldset disabled={!enabled || pending}>
        <legend>A te tipped</legend>
        <label>Becsült palackár (Ft)<input inputMode="numeric" value={value.price} onChange={e => change('price', e.target.value)} required /></label>
        <label>Becsült alkoholfok (% vol)<input inputMode="decimal" value={value.alcohol} onChange={e => change('alcohol', e.target.value)} required /></label>
        <label>Tetszés (1–10)<select value={value.liking} onChange={e => change('liking', e.target.value)} required>
          <option value="">Válassz értéket</option>{Array.from({ length: 10 }, (_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
        </select></label>
        <p className="small-note">1: egyáltalán nem ízlik · 10: nagyon ízlik. A tetszés nem ad versenypontot.</p>
        <button className="button-primary" type="submit">{pending ? 'Beküldés…' : saved ? 'Tipp módosítása' : 'Tipp beküldése'}</button>
      </fieldset>
      {draft && <p className="small-note">A mezőkben lévő módosítás még nincs visszaigazolva. Újratöltéskor a piszkozat elvész.</p>}
      {!!errors.length && <div className="auth-message" role="alert" tabIndex={-1} ref={errorBox}>{errors.map(text => <p key={text}>{text}</p>)}</div>}
      {!saved && !enabled && <p>Nincs visszaigazolt tipped ehhez a körhöz.</p>}
    </form>}
  </>;
}
