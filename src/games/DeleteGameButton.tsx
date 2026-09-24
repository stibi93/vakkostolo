import { useRef, useState } from 'react';
import type { GamesApi } from './model';
import { gameErrorMessage } from './api';

export function DeleteGameButton({ api, id, title, onDeleted }: {
  api: GamesApi; id: string; title: string; onDeleted: () => void;
}) {
  const [confirm, setConfirm] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState('');
  const busy = useRef(false), trigger = useRef<HTMLButtonElement>(null);
  if (!api.remove) return null;
  async function remove() {
    if (busy.current || !api.remove) return;
    busy.current = true; setPending(true); setError('');
    try { await api.remove(id); onDeleted(); }
    catch (error) { setError(gameErrorMessage(error)); }
    finally { busy.current = false; setPending(false); }
  }
  return <div className="game-delete">
    {!confirm ? <button ref={trigger} className="button-secondary" onClick={() => setConfirm(true)}>Kóstoló törlése<span className="sr-only"> · {title}</span></button>
      : <div role="group" aria-label={`Kóstoló törlésének megerősítése: ${title}`} className="auth-message">
        <p><strong>„{title}” törlése?</strong></p>
        <p>A borok, fotók, meghívók és minden beküldött értékelés végleg törlődik. Futó kóstoló esetén a játékosok hozzáférése is megszűnik.</p>
        <div className="schedule-actions">
          <button className="button-secondary" disabled={pending} onClick={() => { setConfirm(false); setError(''); requestAnimationFrame(() => trigger.current?.focus()); }}>Mégse</button>
          <button className="button-primary" disabled={pending} onClick={() => void remove()}>{pending ? 'Törlés…' : 'Végleges törlés'}</button>
        </div>
        {error && <p role="alert">{error}</p>}
      </div>}
  </div>;
}
