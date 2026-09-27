import { useEffect, useState, useSyncExternalStore } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useParams } from 'react-router';
import { PageFrame } from '../app/PageFrame';
import { clearReturnPath, rememberReturnPath } from '../auth/return-path';
import { authRuntime } from '../auth/runtime';
import type { createAuthStore } from '../auth/store';
import { inviteErrorMessage } from './api';
import { isInviteToken, nicknameError } from './model';
import type { InvitePreview, InvitesApi, Membership } from './model';
import './invites.css';

export function JoinPage() {
  const { token } = useParams();
  return <PageFrame>
    <section className="auth-panel join-panel" aria-labelledby="join-title">
      <p className="eyebrow">MEGHÍVÓ</p>
      {authRuntime.status !== 'ready' ? <>
        <h1 id="join-title">A belépés most nem elérhető.</h1>
        <p>Az online kapcsolat nincs beállítva ezen a címen. Kérd el a játékmestertől a kóstoló működő meghívólinkjét.</p>
      </> : !isInviteToken(token) ? <>
        <h1 id="join-title">Ez a meghívó nem érvényes.</h1>
        <p>Ellenőrizd, hogy a teljes linket nyitottad-e meg, vagy olvasd be újra a QR-kódot.</p>
      </> : <GuestJoin key={token} api={authRuntime.invites} store={authRuntime.store} token={token} />}
    </section>
  </PageFrame>;
}

type JoinState = { status: 'checking' } | { status: 'form'; preview: InvitePreview } | { status: 'joined'; membership: Membership } |
  { status: 'error'; message: string };

/** Short display name from a Google profile, to prefill the nickname. */
function googleNickname(metadata: Record<string, unknown> | undefined): string {
  const name = [metadata?.given_name, metadata?.full_name, metadata?.name].find((value) => typeof value === 'string');
  const first = typeof name === 'string' ? name.trim().split(/\s+/)[0] ?? '' : '';
  return nicknameError(first) ? '' : first;
}

function GuestJoin({ api, store, token }: { api: InvitesApi; store: ReturnType<typeof createAuthStore>; token: string }) {
  const auth = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const googleUser = auth.user && auth.user.is_anonymous === false ? auth.user : null;
  const [state, setState] = useState<JoinState>({ status: 'checking' });
  const [attempt, setAttempt] = useState(0);
  const [nickname, setNickname] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    clearReturnPath(window.sessionStorage);
    void store.start();
  }, [store]);
  const [edited, setEdited] = useState(false);
  const googleName = googleUser ? googleNickname(googleUser.user_metadata) : '';
  const nicknameValue = edited ? nickname : nickname || googleName;
  useEffect(() => {
    let active = true;
    api.resume(token).then(async (membership) => {
      const next: JoinState = membership ? { status: 'joined', membership } : { status: 'form', preview: await api.preview(token) };
      if (active) setState(next);
    }).catch((error: unknown) => { if (active) setState({ status: 'error', message: inviteErrorMessage(error) }); });
    return () => { active = false; };
  }, [api, token, attempt]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = nicknameError(nicknameValue);
    if (problem) { setMessage(problem); return; }
    setPending(true);
    setMessage(null);
    try {
      setState({ status: 'joined', membership: await api.join(token, nicknameValue) });
    } catch (error) {
      setMessage(inviteErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  if (state.status === 'checking') return <><h1 id="join-title">Meghívó</h1><p role="status">A meghívó ellenőrzése…</p></>;
  if (state.status === 'error') return <>
    <h1 id="join-title">Nem sikerült belépni.</h1>
    <p role="alert" className="auth-message">{state.message}</p>
    <button className="button-primary" onClick={() => { setState({ status: 'checking' }); setAttempt((value) => value + 1); }}>
      Újrapróbálás</button>
  </>;
  if (state.status === 'joined') return <Navigate to={`/play/${state.membership.gameId}`} replace />;
  const { preview } = state;
  if (!preview.joinable) return <>
    <h1 id="join-title">{preview.title}</h1>
    <p role="alert" className="auth-message">Ebbe a kóstolóba már nem lehet belépni.</p>
  </>;
  return <>
    <p className="join-invited">Erre a kóstolóra hívtak meg:</p>
    <h1 id="join-title">{preview.title}</h1>
    <p>Ellenőrizd, hogy a kivetítőn vagy a játékmesternél is ez a cím látszik. Adj meg egy becenevet:
      ezt látja a játékmester és a többi játékos. Regisztráció nem kell.</p>
    <form className="join-form" onSubmit={(event) => void submit(event)} noValidate>
      <label htmlFor="nickname">Becenév</label>
      <input id="nickname" name="nickname" value={nicknameValue} onChange={(event) => { setEdited(true); setNickname(event.target.value); }}
        autoComplete="nickname" enterKeyHint="go" maxLength={60} required aria-describedby={message ? 'join-error' : undefined} />
      {message && <p id="join-error" role="alert" className="auth-message">{message}</p>}
      <button className="button-primary" type="submit" disabled={pending}>{pending ? 'Belépés…' : 'Belépés a váróba'}</button>
    </form>
    {googleUser ? <p className="small-note">Google-fiókkal vagy belépve{googleUser.email ? ` (${googleUser.email})` : ''}.
      Ezzel a fiókkal másik eszközről is visszatérhetsz ebbe a kóstolóba.</p>
      : <div className="join-google">
        <p>Nem kötelező: ha Google-fiókkal lépsz be, másik telefonról vagy böngészőből is visszatérhetsz ide.</p>
        <button className="button-secondary" type="button" disabled={auth.status === 'loading' || !!auth.pending}
          onClick={() => { rememberReturnPath(window.sessionStorage, `/join/${token}`); void store.signInWithGoogle(); }}>
          {auth.pending === 'sign-in' ? 'Átirányítás a Google-belépéshez…' : 'Belépés Google-fiókkal'}</button>
        {auth.message && <p role="alert" className="auth-message">{auth.message}</p>}
      </div>}
  </>;
}
