import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { FormEvent } from 'react';
import { canSubmit, remainingSeconds, revealableIndexes, scoreRating, validateRating } from '../domain/game';
import type { GameStatus, Rating, RoundStatus } from '../domain/game';
import { summarizeWithoutAi } from '../ai/summary';
import { demoWines } from './data';
import { TastingArtwork } from './TastingArtwork';

type View = 'host' | 'player' | 'presentation';
interface DemoRound { status: RoundStatus; closesAt: number }
const labels: Record<RoundStatus, string> = {
  pending: 'Címke letakarva', open: 'Most ezt kóstoljuk', closed: 'Tippek lezárva', revealed: 'Felfedve',
};
const gameLabels: Record<GameStatus, string> = {
  draft: 'Előkészítés', lobby: 'Váró nyitva', tasting: 'Kóstolás',
  intermission: 'Szünet', reveal: 'Felfedés', finished: 'Kóstoló vége',
};
const huf = (value: number) => `${value.toLocaleString('hu-HU')} Ft`;
const alcohol = (value: number) => `${(value / 10).toLocaleString('hu-HU')}%`;
const number = (value: number) => String(value).padStart(2, '0');

export function DemoApp() {
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
    setNotice('A tippeket lezártuk. Jöhet a következő lépés.');
  }

  function revealBlock() {
    if (!block.length || status !== 'intermission') return;
    setRounds((previous) => previous.map((round, index) => block.includes(index) ? { ...round, status: 'revealed' } : round));
    setStatus('reveal');
    setNotice('A blokk borai és eredményei most már a Prezentáció nézetben is látszanak.');
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
        <Link className="brand" to="/" aria-label="Vakpohár, kezdőlap">vakpohár<span aria-hidden="true">.</span></Link>
        <span className="topbar-note">BOR VAN. CÍMKE NINCS.</span>
        <span className="demo-badge"><span aria-hidden="true" />PRÓBAKÓSTOLÓ</span>
      </header>

      <main id="main" tabIndex={-1}>
        <section className="hero">
          <div className="hero-editorial">
            <p className="eyebrow">VAKKÓSTOLÓ, BARÁTOK KÖZÖTT</p>
            <h1>Na, ez<br /><span>melyik?</span></h1>
            <p className="hero-copy">Tölts egy pohárral. Mondd meg, mit gondolsz.<br />{' '}Aztán nézzük meg, mi volt a palackban.</p>
          </div>
          <TastingArtwork />
          <div className="hero-edition"><span>01 / SZAGOLD</span><span>02 / KÓSTOLD</span><span>03 / TIPPELJ</span></div>
        </section>

        <div className="workspace-heading" id="tasting-table">
          <div className="section-title"><span className="section-mark" aria-hidden="true">↳</span><div><p className="eyebrow">AZ ASZTALNÁL</p><h2>Ma vakon kóstolunk.</h2></div></div>
          <nav className="view-switch" aria-label="Demónézet">
            {([['host', 'Játékmester'], ['player', 'Játékos'], ['presentation', 'Prezentáció']] as const).map(([id, label]) => (
              <button key={id} aria-pressed={view === id} className={view === id ? 'selected' : ''} onClick={() => setView(id)}>{label}</button>
            ))}
          </nav>
        </div>

        <div className="workspace-grid">
          <section className="main-panel">
            <div className="panel-topline"><span className="live-label"><span />{gameLabels[status]}</span><span className="sheet-code">{view === 'host' ? 'HÁZIGAZDA / 01' : view === 'player' ? 'KÓSTOLÓLAP / 02' : 'EREDMÉNYLAP / 03'}</span></div>

            {view === 'host' && <>
              <div className="session-heading">
                <h3>{status === 'lobby' ? 'Mindenki kapott poharat?' : status === 'finished' ? 'Ez jó kör volt.' : `${number(activeIndex + 1)}. tétel`}</h3>
                <p className="muted">{status === 'lobby' ? 'Állítsd be az időt és a felfedést. Ha mindenki kész, mehet az első bor.' : 'Te döntöd el, mikor jön a következő bor, és mikor nézzük meg a tippeket.'}</p>
              </div>
              <div className="session-stats">
                <div><strong>03</strong><span>kóstolandó bor</span></div>
                <div><strong>01</strong><span>tesztjátékos</span></div>
                <div><strong>{status === 'tasting' ? `${number(Math.floor(seconds / 60))}:${number(seconds % 60)}` : `${duration / 60}`}</strong><span>{status === 'tasting' ? 'hátralévő idő' : 'perc / tétel'}</span></div>
              </div>
              <div className="settings-row">
                <label>Kóstolási idő<select value={duration} disabled={status !== 'lobby'} onChange={(event) => setDuration(Number(event.target.value))}><option value={60}>1 perc / bor</option><option value={120}>2 perc / bor</option><option value={180}>3 perc / bor</option></select></label>
                <label>Közös felfedés<select value={revealEvery} disabled={status !== 'lobby'} onChange={(event) => setRevealEvery(Number(event.target.value))}><option value={1}>Minden bor után</option><option value={2}>2 boronként</option><option value={3}>Csak a végén</option></select></label>
              </div>
              <div className="actions">
                {canStart && <button className="button-primary" onClick={startRound}>{status === 'lobby' ? 'Kóstoló indítása' : 'Következő tétel'}<span aria-hidden="true">↗</span></button>}
                {status === 'tasting' && <>
                  <button className="button-primary" onClick={closeRound}>Kör lezárása <span aria-hidden="true">→</span></button>
                  <button className="button-secondary" disabled={seconds === 0} onClick={() => {
                    if (!canSubmit(current.status, current.closesAt, Date.now())) return;
                    setRounds((previous) => previous.map((round, index) => index === activeIndex ? { ...round, closesAt: round.closesAt + 30_000 } : round));
                    setNotice('Hozzáadtunk 30 másodpercet a körhöz.');
                  }}>+30 másodperc</button>
                </>}
                {status === 'intermission' && block.length > 0 && <button className="button-primary" onClick={revealBlock}>Eredmények felfedése <span aria-hidden="true">↗</span></button>}
                {status === 'reveal' && revealed.length === rounds.length && <button className="button-primary" onClick={() => { setStatus('finished'); setView('presentation'); setNotice('Minden bor felfedve. Íme a végeredmény.'); }}>Kóstoló befejezése <span aria-hidden="true">↗</span></button>}
                {status === 'finished' && <button className="button-primary" onClick={() => setView('presentation')}>Végeredmény megtekintése <span aria-hidden="true">↗</span></button>}
              </div>
              <p className="small-note">{status === 'tasting' ? `${ratings[activeIndex] ? 1 : 0} / 1 helyi tipp beküldve. ${seconds === 0 ? 'Lejárt az idő; zárd le a kört a továbblépéshez.' : 'A beküldés a Játékos nézetben próbálható ki.'}` : 'A borok neve és valódi adatai a felfedésig rejtve maradnak a játékosnézetben.'}</p>
            </>}

            {view === 'player' && <>
              {status === 'lobby' ? <div className="empty-state"><span className="big-symbol" aria-hidden="true">…</span><h3>Foglaltunk neked helyet.</h3><p>A váróban vagy. A játékmester indítja az első bort; addig készítsd oda a poharad.</p><span className="pill">Te · tesztjátékos</span></div>
                : current.status === 'open' && seconds > 0 ? <RatingForm key={activeIndex} index={activeIndex} seconds={seconds} saved={ratings[activeIndex]} onSubmit={submit} />
                : <div className="empty-state"><span className="big-symbol" aria-hidden="true">✓</span><h3>{status === 'finished' ? 'Jöhet a nagy megfejtés.' : 'Erre a borra ennyi volt.'}</h3><p>{ratings[activeIndex] ? 'A tipped a demóban elmentve. ' : 'Ehhez a tételhez nincs beküldött tipped. '}{revealed.length ? 'A már felfedett borokat a Prezentáció nézetben találod.' : 'A következő lépést a játékmester indítja.'}</p></div>}
            </>}

            {view === 'presentation' && <>
              <div className="session-heading"><h3>{revealed.length ? 'Ez volt a palackban.' : 'Egyelőre marad a kérdőjel.'}</h3><p className="muted">{revealed.length ? 'Fiktív mintaborok, a te helyi tippjeiddel.' : 'A játékmester felfedése után itt látod, mit ittál, és mennyire volt közel a tipped.'}</p></div>
              {revealed.map((index) => <article className="result-card" key={index}><span className="result-number">{number(index + 1)}</span><div><h4>{demoWines[index].name}</h4><p>{huf(demoWines[index].priceHuf)} <span className="separator">/</span> {alcohol(demoWines[index].alcoholTenths)}</p><p className="small-note">{ratings[index] ? `Tipped: ${huf(ratings[index].priceHuf)} · ${alcohol(ratings[index].alcoholTenths)} · Tetszés: ${ratings[index].liking}/10` : 'Nem érkezett tipped erre a tételre.'}</p></div><strong>{ratings[index] ? scoreRating(ratings[index], demoWines[index]) : 0}<small>pont</small></strong></article>)}
              {revealed.length > 0 && <div className="score-summary"><span>{status === 'finished' ? 'Végeredmény' : 'Eddigi eredmény'} · Te</span><strong>{totalScore}<small> / {revealed.length * 100} pont</small></strong></div>}
              {status === 'finished' && <p className="summary-copy">{summarizeWithoutAi({ allRoundsRevealed: true, participantCount: 1, wines: demoWines.map((wine, index) => ({ label: wine.name, responseCount: ratings[index] ? 1 : 0, meanLiking: ratings[index]?.liking ?? null })) })}</p>}
              <p className="small-note">Az ár és az alkohol pontossága ad pontot. A tetszés a személyes kedvencedről szól.</p>
            </>}
          </section>

          <aside className="side-panel">
            <div className="side-heading"><span className="eyebrow">KÓSTOLÁSI SORREND</span><h3>A mai borsor<span>03</span></h3><p>A nevekkel még várunk.</p></div>
            <ol className="wine-list">{rounds.map((round, index) => <li key={index} className={round.status === 'open' ? 'active-wine' : ''}>
              <span className="wine-number">{number(index + 1)}</span><div><strong>{round.status === 'revealed' ? demoWines[index].name.split(' · ')[0] : `${number(index + 1)}. titkos bor`}</strong><span>{round.status === 'open' && seconds === 0 ? 'Lejárt az idő' : labels[round.status]}</span></div><span className="wine-status" aria-hidden="true">{round.status === 'revealed' ? '✓' : round.status === 'open' ? '●' : '○'}</span>
            </li>)}</ol>
            <div className="tasting-tip"><span className="eyebrow">JEGYZET A MARGÓRA</span><p>Nem kell érteni hozzá.<br />Elég, ha van véleményed.</p></div>
            <div className="ticket-bottom"><span>3 BOR / 1 ESTE</span><span aria-hidden="true">✕</span><span>NINCS PUSKA</span></div>
          </aside>
        </div>
        <p className="notice" role="status">{notice}</p>
        <div className="demo-disclaimer"><span className="demo-label">PRÓBAÜZEM</span><p>Ez egy helyi demó: a három nézet ugyanazt a játékot mutatja. QR-belépés és közös online játék még nincs; az oldal frissítése törli a tippeket.</p></div>
      </main>
      <footer><span className="footer-wordmark">vakpohár.</span><span>JÓ TÁRSASÁGHOZ. ISMERETLEN BOROKHOZ.</span><a href="#main">Vissza az elejére ↑</a></footer>
    </div>
  );
}

function RatingForm({ index, seconds, saved, onSubmit }: { index: number; seconds: number; saved?: Rating; onSubmit: (rating: Rating) => boolean }) {
  const [price, setPrice] = useState(saved ? String(saved.priceHuf) : '');
  const [abv, setAbv] = useState(saved ? String(saved.alcoholTenths / 10) : '');
  const [liking, setLiking] = useState(saved?.liking ?? 7);
  const [error, setError] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const amount = Number(abv.replace(',', '.')) * 10;
    const rating: Rating = { priceHuf: Number(price), alcoholTenths: Math.round(amount), liking };
    if (!price.trim() || !abv.trim() || Math.abs(amount - Math.round(amount)) > 1e-8) {
      setError('Add meg az árat és az alkoholfokot; az alkohol egy tizedesjegyű lehet.');
      return;
    }
    const errors = validateRating(rating);
    if (errors.length) { setError(errors.join(' ')); return; }
    setError(onSubmit(rating) ? '' : 'A kör lezárult, ezt a módosítást nem mentettük.');
  }

  return <form className="rating-form" onSubmit={handleSubmit}>
    <div className="rating-heading"><div><p className="eyebrow">A TE TIPPED</p><h3>{number(index + 1)}. titkos bor</h3></div><span className="timer">{number(Math.floor(seconds / 60))}:{number(seconds % 60)}</span></div>
    <p className="muted">Mennyit adnál érte? Milyen erős? És a lényeg: ízlik?</p>
    <div className="rating-inputs"><label>Becsült palackár <span>Ft / 0,75 l</span><input type="number" inputMode="numeric" min="0" max="1000000" step="1" required placeholder="pl. 4500" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
      <label>Becsült alkoholfok <span>% vol</span><input type="text" inputMode="decimal" required placeholder="pl. 13,5" value={abv} onChange={(event) => setAbv(event.target.value)} /></label></div>
    <label className="liking-label" htmlFor="liking">Mennyire ízlik?<strong>{liking}<span> / 10</span></strong></label>
    <input id="liking" type="range" min="1" max="10" step="1" value={liking} onChange={(event) => setLiking(Number(event.target.value))} />
    <div className="range-labels"><span>1 — Ezt kihagyom</span><span>10 — Jöhet még!</span></div>
    {error && <p role="alert" className="error">{error}</p>}
    <button type="submit" className="button-primary">{saved ? 'Tipp módosítása' : 'Tipp beküldése'}<span aria-hidden="true">↗</span></button>
    <p className="small-note">{saved ? 'Van mentett tipped ebben a demóban. Új értékeket a módosítás gombbal küldhetsz be.' : 'A tippedet a kör végéig módosíthatod.'}</p>
  </form>;
}
