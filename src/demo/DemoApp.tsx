import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { HomeMotionToggle } from '../ui/HomeAtmosphere';
import { useAppMotion } from '../ui/useAppMotion';
import type { FormEvent } from 'react';
import { canSubmit, priceBucketLabel, remainingSeconds, revealableIndexes, scoreRating, validateRating } from '../domain/game';
import type { GameStatus, Rating, RoundStatus } from '../domain/game';
import { RatingFields } from '../rating/RatingFields';
import { draftFromRating, ratingFromDraft } from '../rating/draft';
import type { RatingDraft } from '../rating/draft';
import { summarizeWithoutAi } from '../ai/summary';
import { demoWines } from './data';
import { TastingArtwork } from './TastingArtwork';
import { WinePhoto } from '../ui/WinePhoto';
import { DemoPhotoEditor } from './DemoPhotoEditor';
import { useDemoPhotos } from './useDemoPhotos';

type View = 'host' | 'player' | 'presentation';
interface DemoRound { status: RoundStatus; closesAt: number }
const labels: Record<RoundStatus, string> = {
  pending: 'Még nem indult', open: 'Kóstolás folyamatban', closed: 'Tippek lezárva', revealed: 'Felfedve',
};
const gameLabels: Record<GameStatus, string> = {
  draft: 'Előkészítés', lobby: 'Váró nyitva', tasting: 'Kóstolás',
  intermission: 'Szünet', reveal: 'Felfedés', finished: 'Kóstoló vége',
};
const huf = (value: number) => `${value.toLocaleString('hu-HU')} Ft`;
const alcohol = (value: number) => `${(value / 10).toLocaleString('hu-HU')}%`;
const number = (value: number) => String(value).padStart(2, '0');

export function DemoApp() {
  const motion = useAppMotion();
  const demoPhotos = useDemoPhotos();
  const [view, setView] = useState<View>('host');
  const [status, setStatus] = useState<GameStatus>('lobby');
  const [rounds, setRounds] = useState<DemoRound[]>(() => demoWines.map(() => ({ status: 'pending', closesAt: 0 })));
  const [activeIndex, setActiveIndex] = useState(0);
  const [ratings, setRatings] = useState<Record<number, Rating>>({});
  const [duration, setDuration] = useState(120);
  const [revealEvery, setRevealEvery] = useState(2);
  const [now, setNow] = useState(Date.now);
  const [notice, setNotice] = useState('Válassz nézetet, és próbáld ki egy kóstoló menetét.');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);

  const current = rounds[activeIndex];
  const seconds = remainingSeconds(current.closesAt, now);
  const block = revealableIndexes(rounds.map((round) => round.status), revealEvery);
  const pendingIndex = rounds.findIndex((round) => round.status === 'pending');
  const revealed = rounds.flatMap((round, index) => round.status === 'revealed' ? [index] : []);
  const totalScore = revealed.reduce((sum, index) => sum + (ratings[index] ? scoreRating(ratings[index], demoWines[index]) : 0), 0);

  function startRound() {
    if (pendingIndex < 0 || status === 'tasting' || block.length) return;
    const time = Date.now();
    setNow(time);
    setActiveIndex(pendingIndex);
    setRounds((previous) => previous.map((round, index) => index === pendingIndex
      ? { status: 'open', closesAt: time + duration * 1000 } : round));
    setStatus('tasting');
    setNotice('A kör elindult. A Játékos nézetben beküldheted a tippedet.');
  }

  function closeRound() {
    if (status !== 'tasting') return;
    setRounds((previous) => previous.map((round, index) => index === activeIndex ? { ...round, status: 'closed' } : round));
    setStatus('intermission');
    setNotice('A kör lezárult. A tippek már nem módosíthatók.');
  }

  function revealBlock() {
    if (!block.length || status !== 'intermission') return;
    setRounds((previous) => previous.map((round, index) => block.includes(index) ? { ...round, status: 'revealed' } : round));
    setStatus('reveal');
    setNotice('A felfedett borok és az eredmények a Prezentáció nézetben láthatók.');
  }

  function submit(rating: Rating): boolean {
    if (!canSubmit(current.status, current.closesAt, Date.now()) || validateRating(rating).length) {
      setNotice('A kör már lezárult, vagy a válasz nem érvényes.');
      return false;
    }
    setRatings((previous) => ({ ...previous, [activeIndex]: rating }));
    setNotice('Tipp elmentve a demóban. A kör végéig módosíthatod.');
    return true;
  }

  const canStart = pendingIndex >= 0 && !block.length && ['lobby', 'intermission', 'reveal'].includes(status);

  return (
    <div className="app-shell" data-view={view}>
      <a className="skip-link" href="#main">Ugrás a tartalomhoz</a>
      <header className="topbar">
        <Link className="brand" to="/" aria-label="Vakkóstoló, kezdőlap">Vakkóstoló</Link>
        <span className="demo-badge"><span aria-hidden="true" />PRÓBAKÓSTOLÓ</span>
        <HomeMotionToggle motion={motion} />
      </header>

      <main id="main" tabIndex={-1}>
        <section className="hero">
          <div className="hero-editorial">
            <p className="eyebrow">PRÓBAKÓSTOLÓ MINTAADATOKKAL</p>
            <h1>Helyi <span>demó</span></h1>
            <p className="hero-copy">Próbáld ki a tippek beküldését<br />{' '}és az eredmények felfedését három mintaborral.</p>
          </div>
          <TastingArtwork />
          <div className="hero-edition"><span>01 / BEÁLLÍTÁS</span><span>02 / ÉRTÉKELÉS</span><span>03 / EREDMÉNYEK</span></div>
        </section>

        <div className="workspace-heading" id="tasting-table">
          <div className="section-title"><span className="section-mark" aria-hidden="true">↳</span><div><p className="eyebrow">DEMÓNÉZETEK</p><h2>A kóstoló menete</h2></div></div>
          <nav className="view-switch" aria-label="Demónézet">
            {([['host', 'Játékmester'], ['player', 'Játékos'], ['presentation', 'Prezentáció']] as const).map(([id, label]) => (
              <button key={id} aria-pressed={view === id} className={view === id ? 'selected' : ''} onClick={() => setView(id)}>{label}</button>
            ))}
          </nav>
        </div>

        <div className="workspace-grid">
          <section className="main-panel">
            <div className="panel-topline"><span className="live-label"><span />{gameLabels[status]}</span><span className="sheet-code">{view === 'host' ? 'JÁTÉKMESTER / 01' : view === 'player' ? 'KÓSTOLÓLAP / 02' : 'EREDMÉNYLAP / 03'}</span></div>

            {view === 'host' && <>
              <div className="session-heading">
                <h3>{status === 'lobby' ? 'Kóstoló beállítása' : status === 'finished' ? 'A kóstoló véget ért' : `${number(activeIndex + 1)}. tétel`}</h3>
                <p className="muted">{status === 'lobby' ? 'Állítsd be a körök hosszát és a felfedés gyakoriságát, majd indítsd el a kóstolót.' : 'A következő tételt és az eredmények felfedését a játékmester indítja.'}</p>
              </div>
              <div className="session-stats">
                <div><strong>03</strong><span>kóstolandó bor</span></div>
                <div><strong>01</strong><span>tesztjátékos</span></div>
                <div><strong>{status === 'tasting' ? `${number(Math.floor(seconds / 60))}:${number(seconds % 60)}` : `${duration / 60}`}</strong><span>{status === 'tasting' ? 'hátralévő idő' : 'perc / tétel'}</span></div>
              </div>
              <div className="settings-row">
                <label>Kóstolási idő<select value={duration} disabled={status !== 'lobby'} onChange={(event) => setDuration(Number(event.target.value))}><option value={60}>1 perc / bor</option><option value={120}>2 perc / bor</option><option value={180}>3 perc / bor</option></select></label>
                <label>Felfedés gyakorisága<select value={revealEvery} disabled={status !== 'lobby'} onChange={(event) => setRevealEvery(Number(event.target.value))}><option value={1}>Minden bor után</option><option value={2}>2 boronként</option><option value={3}>Csak a végén</option></select></label>
              </div>
              <div className="actions">
                {canStart && <button className="button-primary" onClick={startRound}>{status === 'lobby' ? 'Kóstoló indítása' : 'Következő tétel'}<span aria-hidden="true">↗</span></button>}
                {status === 'tasting' && <>
                  <button className="button-primary" onClick={closeRound}>Kör lezárása <span aria-hidden="true">→</span></button>
                  <button className="button-secondary" disabled={seconds === 0} onClick={() => {
                    if (!canSubmit(current.status, current.closesAt, Date.now())) return;
                    setRounds((previous) => previous.map((round, index) => index === activeIndex ? { ...round, closesAt: round.closesAt + 30_000 } : round));
                    setNotice('A kör ideje 30 másodperccel meghosszabbítva.');
                  }}>+30 másodperc</button>
                </>}
                {status === 'intermission' && block.length > 0 && <button className="button-primary" onClick={revealBlock}>Eredmények felfedése <span aria-hidden="true">↗</span></button>}
                {status === 'reveal' && revealed.length === rounds.length && <button className="button-primary" onClick={() => { setStatus('finished'); setView('presentation'); setNotice('A kóstoló véget ért. Minden bor és a végeredmény megtekinthető.'); }}>Kóstoló befejezése <span aria-hidden="true">↗</span></button>}
                {status === 'finished' && <button className="button-primary" onClick={() => setView('presentation')}>Végeredmény megtekintése <span aria-hidden="true">↗</span></button>}
              </div>
              <p className="small-note">{status === 'tasting' ? `${ratings[activeIndex] ? 1 : 0} / 1 helyi tipp beküldve. ${seconds === 0 ? 'Lejárt az idő; zárd le a kört a továbblépéshez.' : 'A beküldés a Játékos nézetben próbálható ki.'}` : 'A borok neve és valódi adatai a felfedésig rejtve maradnak a játékosnézetben.'}</p>
              <DemoPhotoEditor {...demoPhotos} />
            </>}

            {view === 'player' && <>
              {status === 'lobby' ? <div className="empty-state"><span className="big-symbol" aria-hidden="true">…</span><h3>Várakozás az indításra</h3><p>Az első tételt a Játékmester nézetben indíthatod el.</p><span className="pill">Te · tesztjátékos</span></div>
                : current.status === 'open' && seconds > 0 ? <RatingForm key={activeIndex} index={activeIndex} seconds={seconds} saved={ratings[activeIndex]} onSubmit={submit} />
                : <div className="empty-state"><span className="big-symbol" aria-hidden="true">✓</span><h3>{status === 'finished' ? 'A kóstoló véget ért' : 'A kör lezárult'}</h3><p>{ratings[activeIndex] ? 'A tippedet elmentettük a demóban. ' : 'Ehhez a tételhez nincs beküldött tipped. '}{revealed.length ? 'A már felfedett borokat a Prezentáció nézetben találod.' : 'A következő lépést a játékmester indítja.'}</p></div>}
            </>}

            {view === 'presentation' && <>
              <div className="session-heading"><h3>{revealed.length ? 'Felfedett borok' : 'Még nincs felfedett bor'}</h3><p className="muted">{revealed.length ? 'Mintaborok és a demóban beküldött tippjeid.' : 'A felfedés után itt jelennek meg a boradatok, a tippjeid és a pontszámaid.'}</p></div>
              {revealed.map((index) => <article className="result-card" key={index}><WinePhoto src={demoPhotos.photos[index].src} alt={`${demoWines[index].name} – ${demoPhotos.photos[index].custom ? 'saját kép' : 'AI-mintafotó'}`} number={number(index + 1)} /><div><h4>{demoWines[index].name}</h4><p className="small-note">{demoPhotos.photos[index].src ? demoPhotos.photos[index].custom ? 'Saját kép · helyi demó' : 'AI-val készített mintafotó' : 'Kép nélküli mintabor'}</p><p>{huf(demoWines[index].priceHuf)} <span className="separator">/</span> {alcohol(demoWines[index].alcoholTenths)}</p><p className="small-note">{ratings[index] ? `Tipped: ${priceBucketLabel(ratings[index].priceBucket)} · ${alcohol(ratings[index].alcoholTenths)} · Tetszés: ${ratings[index].liking}/10` : 'Nem érkezett tipped erre a tételre.'}</p></div><strong>{ratings[index] ? scoreRating(ratings[index], demoWines[index]) : 0}<small>pont</small></strong></article>)}
              {revealed.length > 0 && <div className="score-summary"><span>{status === 'finished' ? 'Végeredmény' : 'Eddigi eredmény'} · Te</span><strong>{totalScore}<small> / {revealed.length * 100} pont</small></strong></div>}
              {status === 'finished' && <p className="summary-copy">{summarizeWithoutAi({ allRoundsRevealed: true, participantCount: 1, wines: demoWines.map((wine, index) => ({ label: wine.name, responseCount: ratings[index] ? 1 : 0, meanLiking: ratings[index]?.liking ?? null })) })}</p>}
            </>}
          </section>

          <aside className="side-panel">
            <div className="side-heading"><span className="eyebrow">KÓSTOLÁSI SORREND</span><h3>Mintaborok<span>03</span></h3><p>A borok neve a felfedés után látható.</p></div>
            <ol className="wine-list">{rounds.map((round, index) => <li key={index} className={round.status === 'open' ? 'active-wine' : ''}>
              <span className="wine-number">{number(index + 1)}</span><div><strong>{round.status === 'revealed' ? demoWines[index].name.split(' · ')[0] : `${number(index + 1)}. tétel`}</strong><span>{round.status === 'open' && seconds === 0 ? 'Lejárt az idő' : labels[round.status]}</span></div><span className="wine-status" aria-hidden="true">{round.status === 'revealed' ? '✓' : round.status === 'open' ? '●' : '○'}</span>
            </li>)}</ol>
            <div className="ticket-bottom"><span>3 MINTABOR</span><span aria-hidden="true">✕</span><span>HELYI DEMÓ</span></div>
          </aside>
        </div>
        <p className="notice" role="status">{notice}</p>
        <div className="demo-disclaimer"><span className="demo-label">PRÓBAÜZEM</span><p>Ez egy helyi demó: a három nézet ugyanazt a játékot mutatja. Az online játékot külön, a Játékmesteri belépésnél készítheted elő. Itt az oldal frissítése törli a tippeket és a saját képeket.</p></div>
      </main>
      <footer><a href="#main">Vissza az elejére ↑</a></footer>
    </div>
  );
}

function RatingForm({ index, seconds, saved, onSubmit }: { index: number; seconds: number; saved?: Rating; onSubmit: (rating: Rating) => boolean }) {
  const [draft, setDraft] = useState<RatingDraft>(() => draftFromRating(saved));
  const [error, setError] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const rating = ratingFromDraft(draft);
    const errors = validateRating(rating);
    if (errors.length) { setError(errors.join(' ')); return; }
    setError(onSubmit(rating) ? '' : 'A kör lezárult, ezt a módosítást nem mentettük.');
  }

  return <form className="rating-form" onSubmit={handleSubmit}>
    <div className="round-label"><div><p className="eyebrow">AKTUÁLIS TÉTEL</p><h3>{number(index + 1)}. tétel</h3><p>A bor neve a felfedésig rejtve marad.</p></div><span className="round-label-number" aria-hidden="true">{number(index + 1)}</span></div>
    <div className="rating-heading"><div><p className="eyebrow">KÓSTOLÓLAP</p><h3>A te értékelésed</h3></div><span className="timer" aria-label={`Hátralévő idő: ${seconds} másodperc`}>{number(Math.floor(seconds / 60))}:{number(seconds % 60)}</span></div>
    <RatingFields value={draft} onChange={setDraft} />
    {error && <p role="alert" className="error">{error}</p>}
    <button type="submit" className="button-primary">{saved ? 'Tipp módosítása' : 'Tipp beküldése'}<span aria-hidden="true">↗</span></button>
    <p className="small-note">{saved ? 'A tippedet elmentettük a demóban. A kör végéig módosíthatod a Tipp módosítása gombbal.' : 'A tippedet a kör végéig módosíthatod.'}</p>
  </form>;
}
