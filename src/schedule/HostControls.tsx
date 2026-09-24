import { useRef, useState } from 'react';
import { lobbyErrorMessage } from '../lobby/api';
import type { GameSnapshot } from '../live/model';
import type { ScheduleApi, TastingAction } from './model';
import { newRequestId } from './model';
import './schedule.css';
export function HostControls({ api, snapshot, refresh, available, secondsLeft }: {
  api: ScheduleApi; snapshot: GameSnapshot; refresh: () => Promise<void>; available: boolean; secondsLeft: number;
}) {
  const [seconds, setSeconds] = useState('120');
  const [pending, setPending] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const busy = useRef(false), receipt = useRef({ signature: '', id: '' });
  const live = snapshot.round?.status === 'open' && secondsLeft > 0 && snapshot.game.status === 'tasting';
  async function act(action: TastingAction, duration?: number) {
    if (busy.current || !available) return;
    const signature = JSON.stringify([snapshot.game.version, action, duration]);
    if (receipt.current.signature !== signature) receipt.current = { signature, id: newRequestId() };
    busy.current = true; setPending(true); setError(''); setNotice('');
    try { await api.control(snapshot.game.id, snapshot.game.version, receipt.current.id, action, duration);
      setNotice(action === 'time' ? 'Az új határidő mentve.' : 'A művelet mentve.'); }
    catch (error) { setError(lobbyErrorMessage(error)); }
    finally { await refresh(); busy.current = false; setPending(false); }
  }
  if (['draft','lobby','finished'].includes(snapshot.game.status)) return null;
  return <section className="host-controls" aria-label="Élő vezérlés">
    <h3>Élő vezérlés</h3>
    <fieldset disabled={pending || !available} className="schedule-fields">
      <legend className="sr-only">A kóstoló vezérlése</legend>
      {live ? <>
        <form className="schedule-time" onSubmit={event => { event.preventDefault(); void act('time', Number(seconds)); }}>
          <label>Hátralévő idő mostantól (másodperc)<input type="number" min="30" max="1800" step="1" required value={seconds} onChange={e => setSeconds(e.target.value)} /></label>
          <button className="button-secondary" type="submit">Idő beállítása</button>
        </form>
        <p className="small-note">Az új idő a mentéstől számít. A játékosok kitöltött mezői megmaradnak.</p>
        <button className="button-secondary" onClick={() => void act('close')}>Kör lezárása most</button>
        <p className="small-note">Lezárás után ehhez a borhoz már nem érkezhet tipp.</p>
      </> : <>
        <div className="schedule-actions"><button className="button-primary" onClick={() => void act('next')}>Következő lépés indítása</button>
          <button className="button-secondary" onClick={() => void act('reveal')}>Lezárt blokk felfedése</button>
          <button className="button-secondary" onClick={() => void act('finish')}>Kóstoló befejezése</button></div>
        <p className="small-note">A következő lépés a mentett sorrend szerinti bor vagy szünet. A felfedés megmutatja a lezárt blokk boradatait a játékosoknak.</p>
      </>}
    </fieldset>
    {error && <p className="auth-message" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
