import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { MfaError } from './mfa';
import type { MfaApi, TotpEnrollment } from './mfa';
import type { AssuranceLevel } from './store';

const errorText = (error: unknown) => error instanceof MfaError ? error.message
  : 'Nem sikerült kapcsolódni a szerverhez. Próbáld újra.';

type GateState = { status: 'loading' } | { status: 'error'; message: string } |
  { status: 'verify'; factorId: string } | { status: 'setup'; enrollment: TotpEnrollment | null };

/** Second factor for the superadmin; the server independently refuses host RPCs below aal2. */
export function MfaGate({ mfa, aal, onVerified, children }: {
  mfa: MfaApi; aal: AssuranceLevel | null; onVerified: () => Promise<void>; children: ReactNode;
}) {
  const [state, setState] = useState<GateState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (aal === 'aal2') return;
    let active = true;
    mfa.verifiedFactor().then((factorId) => {
      if (active) setState(factorId ? { status: 'verify', factorId } : { status: 'setup', enrollment: null });
    }, (error: unknown) => { if (active) setState({ status: 'error', message: errorText(error) }); });
    return () => { active = false; };
  }, [mfa, aal, attempt]);

  if (aal === 'aal2') return <>{children}</>;
  if (state.status === 'loading') return <p role="status">A kétlépcsős azonosítás ellenőrzése…</p>;
  if (state.status === 'error') return <>
    <p role="alert" className="auth-message">{state.message}</p>
    <button className="button-primary" onClick={() => { setState({ status: 'loading' }); setAttempt((value) => value + 1); }}>
      Újrapróbálás</button>
  </>;
  if (state.status === 'verify') return <section className="mfa-panel" aria-labelledby="mfa-title">
    <h3 id="mfa-title">Második lépés: hitelesítő kód</h3>
    <p>Nyisd meg a hitelesítő appot (pl. Google Authenticator, Microsoft Authenticator, 1Password),
      és írd be a Vakkóstolóhoz tartozó 6 jegyű kódot.</p>
    <CodeForm mfa={mfa} factorId={state.factorId} onVerified={onVerified} submitLabel="Ellenőrzés" />
  </section>;

  const { enrollment } = state;
  return <section className="mfa-panel" aria-labelledby="mfa-title">
    <h3 id="mfa-title">Kétlépcsős azonosítás beállítása</h3>
    <p>A játékmesteri felülethez a jelszó mellett egy hitelesítő app kódja is kell. Ezt egyszer kell beállítani.</p>
    {!enrollment ? <SetupStart mfa={mfa} onReady={(value) => setState({ status: 'setup', enrollment: value })} /> : <>
      <ol className="mfa-steps">
        <li>Telepíts egy hitelesítő appot a telefonodra (pl. Google Authenticator vagy Microsoft Authenticator).</li>
        <li>Az appban olvasd be ezt a QR-kódot. Ha nem megy, add meg kézzel a kulcsot.</li>
        <li>Írd be az app által mutatott 6 jegyű kódot.</li>
      </ol>
      <img className="mfa-qr" src={enrollment.qrCode} alt="QR-kód a hitelesítő app beállításához" width={220} height={220} />
      <p className="mfa-secret">Kulcs kézi megadáshoz: <code>{enrollment.secret}</code></p>
      <CodeForm mfa={mfa} factorId={enrollment.factorId} onVerified={onVerified} submitLabel="Beállítás befejezése" />
      <p className="small-note">Ha a telefon elvész, a hitelesítő a gépen, ahol a Supabase titkos kulcsa
        elérhető, törölhető: <code>npm run superadmin -- reset-mfa &lt;név&gt;</code>.</p>
    </>}
  </section>;
}

function SetupStart({ mfa, onReady }: { mfa: MfaApi; onReady: (enrollment: TotpEnrollment) => void }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function start() {
    setPending(true);
    setMessage(null);
    try { onReady(await mfa.enroll()); } catch (error) { setMessage(errorText(error)); } finally { setPending(false); }
  }
  return <>
    <button className="button-primary" disabled={pending} onClick={() => void start()}>
      {pending ? 'Előkészítés…' : 'Hitelesítő app beállítása'}</button>
    {message && <p role="alert" className="auth-message">{message}</p>}
  </>;
}

function CodeForm({ mfa, factorId, onVerified, submitLabel }: {
  mfa: MfaApi; factorId: string; onVerified: () => Promise<void>; submitLabel: string;
}) {
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      await mfa.verify(factorId, code.replace(/\s/g, ''));
      await onVerified();
    } catch (error) {
      setMessage(errorText(error));
      setCode('');
    } finally {
      setPending(false);
    }
  }
  return <form className="host-sign-in" onSubmit={(event) => void submit(event)} noValidate>
    <label htmlFor="mfa-code">6 jegyű kód</label>
    <input id="mfa-code" name="code" value={code} onChange={(event) => setCode(event.target.value)}
      inputMode="numeric" autoComplete="one-time-code" maxLength={7} required />
    {message && <p role="alert" className="auth-message">{message}</p>}
    <button className="button-primary" type="submit" disabled={pending}>{pending ? 'Ellenőrzés…' : submitLabel}</button>
  </form>;
}
