import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { PageFrame } from '../app/PageFrame';
import { authRuntime } from '../auth/runtime';
import { inviteErrorMessage } from './api';
import { isInviteToken, nicknameError } from './model';
import type { InvitesApi, Membership } from './model';
import './invites.css';

export function JoinPage() {
  const { token } = useParams();
  return <PageFrame>
    <section className="auth-panel join-panel" aria-labelledby="join-title">
      <p className="eyebrow">MEGHÍVÓ</p>
      {authRuntime.status !== 'ready' ? <>
        <h1 id="join-title">A belépés most nem elérhető.</h1>
        <p>Az online kapcsolat nincs beállítva ezen a címen. Addig a próbakóstolóban végigjárhatod a játék menetét.</p>
        <Link className="button-secondary" to="/demo">Próbakóstoló megnyitása</Link>
      </> : !isInviteToken(token) ? <>
        <h1 id="join-title">Ez a meghívó nem érvényes.</h1>
        <p>Ellenőrizd, hogy a teljes linket nyitottad-e meg, vagy olvasd be újra a QR-kódot.</p>
      </> : <GuestJoin api={authRuntime.invites} token={token} />}
    </section>
  </PageFrame>;
}

type JoinState = { status: 'checking' } | { status: 'form' } | { status: 'joined'; membership: Membership } |
  { status: 'error'; message: string };

function GuestJoin({ api, token }: { api: InvitesApi; token: string }) {
  const [state, setState] = useState<JoinState>({ status: 'checking' });
  const [attempt, setAttempt] = useState(0);
  const [nickname, setNickname] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    api.resume(token).then((membership) => {
      if (active) setState(membership ? { status: 'joined', membership } : { status: 'form' });
    }, (error: unknown) => { if (active) setState({ status: 'error', message: inviteErrorMessage(error) }); });
    return () => { active = false; };
  }, [api, token, attempt]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = nicknameError(nickname);
    if (problem) { setMessage(problem); return; }
    setPending(true);
    setMessage(null);
    try {
      setState({ status: 'joined', membership: await api.join(token, nickname) });
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
  if (state.status === 'joined') {
    const { membership } = state;
    return <>
      <h1 id="join-title">{membership.title}</h1>
      <p className="join-status" role="status">Bent vagy a váróban <strong>{membership.nickname}</strong> néven.</p>
      <p>{membership.status === 'lobby' ? 'A játékmester indítja az első bort.'
        : 'A kóstoló már elkezdődött; a következő bortól kapcsolódhatsz be.'}</p>
      <p className="small-note">A belépésed ebben a böngészőben megmarad. Másik eszközről vagy privát ablakból
        új játékosként lépnél be.</p>
      <p className="small-note">Fejlesztés alatt: a belépés és a váró már működik, a kóstolólap még készül.</p>
    </>;
  }
  return <>
    <h1 id="join-title">Belépés a kóstolóba</h1>
    <p>Adj meg egy becenevet. Ezt látja a játékmester és a többi játékos. Regisztráció nem kell.</p>
    <form className="join-form" onSubmit={(event) => void submit(event)} noValidate>
      <label htmlFor="nickname">Becenév</label>
      <input id="nickname" name="nickname" value={nickname} onChange={(event) => setNickname(event.target.value)}
        autoComplete="nickname" enterKeyHint="go" maxLength={60} required aria-describedby={message ? 'join-error' : undefined} />
      {message && <p id="join-error" role="alert" className="auth-message">{message}</p>}
      <button className="button-primary" type="submit" disabled={pending}>{pending ? 'Belépés…' : 'Belépés a váróba'}</button>
    </form>
  </>;
}
