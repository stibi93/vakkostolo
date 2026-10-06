import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { PageFrame } from '../app/PageFrame';
import { authRuntime } from '../auth/runtime';
import { publicAppOrigin } from './model';
import { invitePathFromLink } from './entry-link';
import './invites.css';

export function PlayerEntryPage() {
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const path = invitePathFromLink(link, [window.location.origin, publicAppOrigin()]);
    if (!path) {
      setError(link.trim() ? 'Illeszd be az ehhez az oldalhoz tartozó teljes meghívólinket. Ha nem találod, kérd el a játékmestertől.' : 'Illeszd be a játékmestertől kapott meghívólinket.');
      input.current?.focus();
      return;
    }
    navigate(path);
  }

  return <PageFrame headerAction={<Link className="header-link" to="/" viewTransition>Vissza a kezdőlapra</Link>}>
    <section className="auth-panel join-panel" aria-labelledby="entry-title">
      <p className="eyebrow">JÁTÉKOSBELÉPÉS</p>
      <h1 id="entry-title">Csatlakozás a játékhoz</h1>
      {authRuntime.status !== 'ready' ? <p role="alert" className="auth-message">
        Az online belépés ezen a címen még nincs beállítva. Kérd el a játékmestertől a kóstoló működő meghívólinkjét.
      </p> : <>
        <p>Illeszd be a játékmestertől kapott meghívólinket. A következő lépésben megadhatod a beceneved, és beléphetsz a váróba. Regisztráció nem kell.</p>
        <form className="join-form" onSubmit={submit} noValidate>
          <label htmlFor="invite-link">Meghívólink</label>
          <input ref={input} id="invite-link" name="invite-link" type="url" inputMode="url" autoComplete="off"
            autoCapitalize="none" spellCheck={false} enterKeyHint="go" required value={link}
            onChange={event => { setLink(event.target.value); setError(null); }}
            aria-invalid={error ? true : undefined} aria-describedby={error ? 'invite-link-help invite-link-error' : 'invite-link-help'} />
          <p id="invite-link-help" className="join-link-help">A teljes linket másold ide, a /join/ utáni résszel együtt.</p>
          {error && <p id="invite-link-error" role="alert" className="auth-message">{error}</p>}
          <button className="button-primary" type="submit">Meghívó megnyitása <span aria-hidden="true">↗</span></button>
        </form>
        <aside className="join-entry-help" aria-labelledby="qr-help-title">
          <h2 id="qr-help-title">QR-kódot kaptál?</h2>
          <p>Olvasd be a telefonod kamerájával. A kód közvetlenül a kóstoló belépési oldalára visz.</p>
        </aside>
        <p>A váróban látod a többi résztvevőt. Amint a játékmester elindítja a kört, a kóstolólap automatikusan megjelenik.</p>
      </>}
    </section>
  </PageFrame>;
}
