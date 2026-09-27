import { useRef, useState } from 'react';
import { lobbyErrorMessage } from '../lobby/api';
import type { GameSnapshot } from '../live/model';
import type { ScheduleApi, TastingAction } from './model';
import { newRequestId } from './model';
import './schedule.css';
export function HostControls({ api, snapshot, refresh, available, secondsLeft, compact = false }: {
  api: ScheduleApi; snapshot: GameSnapshot; refresh: () => Promise<void>; available: boolean; secondsLeft: number; compact?: boolean;
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
      setNotice(action === 'time' ? (duration === 0 ? 'Az időkorlát kikapcsolva. A kört kézzel zárhatod le.' : 'Az új határidő mentve.') : 'A művelet mentve.'); }
    catch (error) { setError(lobbyErrorMessage(error)); }
    finally { await refresh(); busy.current = false; setPending(false); }
  }
  if (['draft','lobby','finished'].includes(snapshot.game.status)) return null;
  if (compact) return <section className="host-controls host-controls-compact" aria-label="Élő vezérlés">
    <button className="button-primary" disabled={pending || !available} onClick={() => void act(live ? 'close' : 'next')}>
      {pending ? 'Mentés…' : live ? 'Kör lezárása most' : 'Következő lépés indítása'}</button>
    {error && <p className="auth-message" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
  </section>;
  return <section className="host-controls" aria-label="Élő vezérlés">
    <h3>Élő vezérlés</h3>
    <fieldset disabled={pending || !available} className="schedule-fields">
      <legend className="sr-only">A kóstoló vezérlése</legend>
      {live ? <>
        <form className="schedule-time" onSubmit={event => { event.preventDefault(); void act('time', Number(seconds)); }}>
          <label>Hátralévő idő mostantól (másodperc)<input type="number" min="30" max="1800" step="1" required value={seconds} onChange={e => setSeconds(e.target.value)} /></label>
          <button className="button-secondary" type="submit">{snapshot.round?.closesAt === null ? 'Időkorlát bekapcsolása' : 'Idő beállítása'}</button>
        </form>
        {snapshot.round?.closesAt !== null && <button className="button-secondary" onClick={() => void act('time',0)}>Időkorlát kikapcsolása</button>}
        <p className="small-note">Az új idő a mentéstől számít. A játékosok kitöltött mezői megmaradnak.</p>
        <button className="button-secondary" onClick={() => void act('close')}>Kör lezárása most</button>
        <p className="small-note">Lezárás után ehhez a borhoz már nem érkezhet tipp.</p>
      </> : <>
        <div className="schedule-actions"><button className="button-primary" onClick={() => void act('next')}>Következő lépés indítása</button>
          <button className="button-secondary" onClick={() => void act('finish')}>Kóstoló befejezése</button></div>
        <p className="small-note">A következő lépés a mentett sorrend szerinti bor, szünet vagy Felfedés kártya. Csak a kártyán kijelölt borok válnak láthatóvá.</p>
      </>}
    </fieldset>
    {error && <p className="auth-message" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
