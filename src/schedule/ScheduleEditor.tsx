import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { lobbyErrorMessage } from '../lobby/api';
import type { ScheduleApi, ScheduleStep, TastingSchedule } from './model';
import { newRequestId } from './model';
import './schedule.css';

export function ScheduleEditor({ api, gameId, onSaved, initialPlan }: { initialPlan?: TastingSchedule; api: ScheduleApi; gameId: string; onSaved: () => void }) {
  const [plan, setPlan] = useState<TastingSchedule | null>(null);
  const [editing, setEditing] = useState(false);
  const [steps, setSteps] = useState<ScheduleStep[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  const busy = useRef(false), request = useRef(newRequestId());
  function change(next: ScheduleStep[]) { setSteps(next); setDirty(true); setNotice(''); request.current = newRequestId(); }
  async function load(addKind?: 'break' | 'reveal') {
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    try { const next = await api.get(gameId); setPlan(next); setEditing(true); setSteps([...next.steps.filter(s => s.status === 'pending'), ...(addKind ? [makeStep(addKind)] : [])]); setDirty(!!addKind); request.current = newRequestId(); }
    catch (error) { setError(lobbyErrorMessage(error)); }
    finally { busy.current = false; setPending(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!plan || busy.current) return;
    if (steps.some(s => s.kind === 'reveal' && !(s.reveal_round_ids ?? []).length)) { setError('Minden Felfedés kártyához válassz legalább egy bort.'); return; }
    busy.current = true; setPending(true); setError(''); setNotice('');
    try {
      await api.save(gameId, plan.version, request.current, steps);
      // Keep the same request ID if the response is lost. A retry cannot duplicate steps.
      const next = await api.get(gameId);
      setPlan(next); setSteps(next.steps.filter(s => s.status === 'pending')); setDirty(false);
      request.current = newRequestId(); setEditing(false); setNotice('A menet mentve.'); onSaved();
    } catch (error) { setError(lobbyErrorMessage(error)); }
    finally { busy.current = false; setPending(false); }
  }
  function patch(id: string, value: Partial<ScheduleStep>) { change(steps.map(s => s.id === id ? { ...s, ...value } : s)); }
  function move(index: number, delta: number) {
    const next = [...steps]; [next[index], next[index+delta]] = [next[index+delta], next[index]]; change(next);
  }
  function makeStep(kind: ScheduleStep['kind']): ScheduleStep {
    return { id: newRequestId(), kind, title: kind === 'break' ? 'Szünet' : kind === 'reveal' ? 'Felfedés' : '', message: '', seconds: kind === 'reveal' ? 0 : kind === 'break' ? 300 : 120, reveal_round_ids: [],
      status: 'pending', price_huf: kind === 'wine' ? 3000 : null, alcohol_tenths: kind === 'wine' ? 120 : null, round_position: null };
  }
  function add(kind: ScheduleStep['kind']) { change([...steps, makeStep(kind)]); }
  const history = plan?.steps.filter(s => s.status !== 'pending') ?? [];
  const wineCount = [...history, ...steps].filter(s => s.kind === 'wine').length;
  const saved = initialPlan && (!plan || initialPlan.version >= plan.version) ? initialPlan : plan;
  const kindLabel = (s: ScheduleStep) => s.kind === 'wine' ? 'Bor' : s.kind === 'reveal' ? 'Felfedés' : 'Szünet / átvezetés';
  return <section className="schedule-section" aria-labelledby="schedule-title">
    <div className="schedule-heading"><div><p className="eyebrow">JÁTÉKMESTERI MENET</p><h3 id="schedule-title">Borok és szünetek</h3></div>
      {!editing && <button className="button-secondary" disabled={pending} onClick={() => void load()}>{pending ? 'Betöltés…' : 'Menet szerkesztése'}</button>}</div>
    {!editing && saved?.status !== 'finished' && <div className="schedule-actions">
      <button type="button" className="button-secondary" disabled={pending || (saved?.steps.length ?? 0) >= 60} onClick={() => void load('break')}>Szünet hozzáadása</button>
      <button type="button" className="button-secondary" disabled={pending || (saved?.steps.length ?? 0) >= 60} onClick={() => void load('reveal')}>Felfedés hozzáadása</button>
    </div>}
    {!editing && <p className="small-note">A borok közé szünetet vagy egy- és többboros bemutatót illeszthetsz. A módosításokat a Menet mentése gomb rögzíti.</p>}
    {!editing && saved && <ol className="schedule-list schedule-overview" aria-label="Mentett kóstolómenet">
      {saved.steps.map((s, i) => <li key={s.id} className={`schedule-step schedule-step-${s.kind}`}>
        <div className="schedule-step-heading"><strong>{i+1}. {kindLabel(s)} · {s.title}</strong>
          <span>{s.status === 'pending' ? 'Hátralévő' : s.status === 'open' ? 'Folyamatban' : 'Lezárt'}</span></div>
        {s.message && <p className="live-break-message">{s.message}</p>}
        {s.kind === 'reveal' && <p>Bemutatott tételek: {(s.reveal_round_ids ?? []).map(id => {
          const wine = saved.steps.find(w => w.id === id);
          return wine ? `${wine.round_position}. ${wine.title}` : 'Hiányzó bor';
        }).join(' · ')}</p>}
        {s.kind !== 'reveal' && <p className="small-note">{s.seconds ? `${s.seconds} másodperc` : 'Időkorlát nélkül'}</p>}
      </li>)}
    </ol>}
    {editing && plan && <>
      <button className="button-secondary" disabled={pending} onClick={() => { setEditing(false); setError(''); }}>{dirty ? 'Módosítások elvetése és bezárás' : 'Szerkesztés bezárása'}</button>
      <p>A hátralévő lépéseket szabadon átrendezheted. A borok sorszáma a mentett sorrendet követi; igazítsd hozzá a palackok jelölését is.</p>
      {!!history.length && <details className="schedule-history"><summary>Megkezdett és lezárt lépések ({history.length})</summary>
        <ol>{history.map(s => <li key={s.id}>{s.title} — {s.status === 'open' ? 'folyamatban' : 'lezárt'}</li>)}</ol>
        <p>Ezek boradatai és sorrendje már nem változtathatók. A futó kör idejét a vezérlőn állíthatod.</p></details>}
      {plan.status === 'finished' ? <p>A befejezett kóstoló menete már nem szerkeszthető.</p> : <form onSubmit={event => void save(event)}>
        <fieldset className="schedule-fields" disabled={pending}>
          <legend>Hátralévő lépések</legend>
          {!steps.length && <p>Nincs hátralévő lépés. Itt további bort vagy szünetet is beilleszthetsz.</p>}
          <div className="schedule-actions"><button className="button-secondary" type="button" disabled={wineCount >= 12 || history.length+steps.length >= 60} onClick={() => add('wine')}>Bor hozzáadása</button>
            <button className="button-secondary" type="button" disabled={history.length+steps.length >= 60} onClick={() => add('break')}>Szünet hozzáadása</button>
            <button className="button-secondary" type="button" disabled={history.length+steps.length >= 60} onClick={() => add('reveal')}>Felfedés hozzáadása</button></div>
          <ol className="schedule-list">{steps.map((s, i) => <li key={s.id} className={`schedule-step schedule-step-${s.kind}`}>
            <div className="schedule-step-heading"><strong>{String(history.length+i+1).padStart(2,'0')} / {kindLabel(s)}</strong>
              <div className="schedule-order">
                <button type="button" disabled={i === 0} aria-label={`${i+1}. lépés előrébb`} onClick={() => move(i,-1)}>↑</button>
                <button type="button" disabled={i === steps.length-1} aria-label={`${i+1}. lépés hátrébb`} onClick={() => move(i,1)}>↓</button>
                <button type="button" disabled={s.kind === 'wine' && wineCount === 1} aria-label={`${i+1}. lépés eltávolítása`} onClick={() => change(steps.filter(x => x.id !== s.id))}>Eltávolítás</button>
              </div></div>
            <label>{s.kind === 'wine' ? 'Bor neve és évjárata' : s.kind === 'reveal' ? 'Felfedés címe' : 'Átvezető képernyő címe'}<input required maxLength={s.kind === 'wine' ? 200 : 100} value={s.title} onChange={e => patch(s.id,{title:e.target.value})} /></label>
            {s.kind === 'wine' ? <div className="schedule-wine-fields">
              <label>Valódi palackár (Ft)<input type="number" required min="1" max="1000000" step="1" value={s.price_huf ?? ''} onChange={e => patch(s.id,{price_huf:e.target.value === '' ? null : Number(e.target.value)})} /></label>
              <label>Valódi alkoholfok (% vol)<input type="number" required min="0" max="25" step="0.1" value={s.alcohol_tenths === null ? '' : s.alcohol_tenths/10} onChange={e => patch(s.id,{alcohol_tenths:e.target.value === '' ? null : Math.round(Number(e.target.value)*10)})} /></label>
            </div> : <label>Játékosoknak megjelenő szöveg<textarea rows={3} maxLength={2000} value={s.message} onChange={e => patch(s.id,{message:e.target.value})} /></label>}
            {s.kind === 'reveal' && <fieldset className="reveal-targets"><legend>Bemutatandó borok</legend>
              <p className="small-note">Egy vagy több, a kártya előtt szereplő bort válassz ki. A lezárás önmagában nem fed fel bort.</p>
              {[...history, ...steps.slice(0,i)].filter(w => w.kind === 'wine').map(w => <label key={w.id} className="timer-toggle">
                <input type="checkbox" checked={(s.reveal_round_ids ?? []).includes(w.id)} onChange={e => patch(s.id, { reveal_round_ids: e.target.checked ? [...(s.reveal_round_ids ?? []),w.id] : (s.reveal_round_ids ?? []).filter(id => id !== w.id) })} />
                {w.title || 'Névtelen bor'}
              </label>)}
              {!(s.reveal_round_ids ?? []).length && <p className="small-note">Válassz legalább egy bort a mentéshez.</p>}
              {(s.reveal_round_ids ?? []).some(id => ![...history,...steps.slice(0,i)].some(w => w.kind === 'wine' && w.id === id)) && <p role="alert">Egy kijelölt bor hiányzik vagy a kártya utánra került. Állítsd helyre a sorrendet, vagy távolítsd el a kijelölést.</p>}
              {(s.reveal_round_ids ?? []).filter(id => ![...history,...steps.slice(0,i)].some(w => w.kind === 'wine' && w.id === id)).map(id => <button key={id} type="button" className="button-secondary" onClick={() => patch(s.id,{reveal_round_ids:(s.reveal_round_ids ?? []).filter(x => x !== id)})}>Érvénytelen kijelölés eltávolítása</button>)}
            </fieldset>}
            {s.kind === 'wine' && <label className="timer-toggle"><input type="checkbox" checked={s.seconds !== 0} onChange={e => patch(s.id,{seconds:e.target.checked ? 120 : 0})} />Időkorlát használata</label>}
            {(s.kind === 'break' || s.seconds !== 0) && <label>{s.kind === 'wine' ? 'Beküldési idő (másodperc)' : 'Szünet hossza (másodperc, 0 = óra nélkül)'}
              <input type="number" required min={s.kind === 'wine' ? 30 : 0} max={s.kind === 'wine' ? 1800 : 7200} step="1" value={Number.isFinite(s.seconds) ? s.seconds : ''} onChange={e => patch(s.id,{seconds:e.target.value === '' ? NaN : Number(e.target.value)})} /></label>}
            {s.kind === 'break' && <p className="small-note">A folytatást te indítod el. Az idő lejárta nem indít új bort. Ez a cím és szöveg a szünet kezdetén minden játékosnál megjelenik.</p>}
          </li>)}</ol>

          <p className="small-note">A nyilakkal tedd a kártyákat a kívánt helyre. A játékosok csak az aktuális lépést látják.</p>
          <div className="schedule-actions"><button className="button-primary" type="submit" disabled={!dirty}>{pending ? 'Mentés…' : 'Menet mentése'}</button>
            <button className="button-secondary" type="button" onClick={() => void load()}>{dirty ? 'Piszkozat elvetése és újratöltés' : 'Mentett menet frissítése'}</button></div>
          {dirty && <p className="small-note">A módosítások még nincsenek mentve.</p>}
        </fieldset>
      </form>}
    </>}
    {error && <p className="auth-message" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
