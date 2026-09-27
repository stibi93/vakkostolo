import { CategoryIcon } from '../rating/CategoryIcon';
import { useState } from 'react';
import { CategoryChips, ScoreLenses } from './ScoreLenses';
import { categoryMax, type ScoreLens } from './scorecard';
import { priceBucketLabel } from '../domain/game';
import type { GameResults, ResultPhotoApi, WineResult } from './model';
import { GuessCharts } from './GuessCharts';
import { ResultPhoto } from './ResultPhoto';
import './results.css';
const numeric=(value:number)=>value.toLocaleString('hu-HU',{maximumFractionDigits:1});
const alcohol=(value:number)=>`${numeric(value/10)}% vol`;
const money=(value:number)=>`${value.toLocaleString('hu-HU')} Ft`;

export function ResultsPanel({ results, gameId, selfId, photos, presentation=false, roundIds, intro }: {
  results: GameResults; gameId:string; selfId:string|null; photos?:ResultPhotoApi; presentation?:boolean; roundIds?:string[]; intro?: { title:string; message:string };
}) {
  const wines = roundIds ? roundIds.flatMap(id => results.wines.filter(w => w.id === id)) : results.wines;
  const [selected,setSelected]=useState(roundIds ? 0 : wines.length-1);
  const [view,setView]=useState<'wine'|'guesses'|'ranking'>('wine');
  const [page,setPage]=useState(0);
  const wine=wines[Math.min(selected,wines.length-1)];
  const self=results.leaderboard.find(e=>e.id===selfId);
  const pageSize=presentation?5:50;
  if(!wine) return <p>Még nincs felfedett eredmény. A borok a játékmester felfedése után jelennek meg.</p>;
  return <section className={`results-panel${presentation?' results-presentation':''}`} aria-label="Kóstoló eredményei">
    <header className="results-heading"><div><p className="eyebrow">{intro ? 'FELFEDÉS / BEMUTATÓ' : results.final?'VÉGEREDMÉNY':'FELFEDETT EREDMÉNYEK'}</p>
      <h2>{intro?.title ?? (results.final?'A kóstoló eredménye':'Eddigi eredmények')}</h2>
      {intro?.message && <p className="live-break-message">{intro.message}</p>}
      {!presentation && <p>{results.revealedCount} felfedett bor · legfeljebb {results.maxPoints} pont</p>}</div>
      {!presentation && self && <div className="results-own-total"><strong>{self.points}</strong><span>pont összesen · {self.rank}. hely</span></div>}
    </header>
    {!presentation && !results.final && <p className="small-note">Csak a már felfedett borok számítanak bele. A sorrend a következő felfedéskor változhat.</p>}
    {results.leaderboard.some(e=>e.unscored>0) && <p className="auth-message">Egy régi pontozású válaszból hiányzik a forintos ártipp. Ez a válasz nem pontozható; az összesítés hiányos.</p>}
    <nav className="results-switch" aria-label="Eredménynézet">
      <button className={view==='wine'?'button-primary':'button-secondary'} aria-pressed={view==='wine'} onClick={()=>setView('wine')}>Borlapok</button>
      {presentation && <button className={view==='guesses'?'button-primary':'button-secondary'} aria-pressed={view==='guesses'} onClick={()=>setView('guesses')}>Tippeloszlás</button>}
      <button className={view==='ranking'?'button-primary':'button-secondary'} aria-pressed={view==='ranking'} onClick={()=>setView('ranking')}>Ranglista</button>
    </nav>
    {view==='guesses' ? <GuessCharts wine={wine} own={null} presentation /> : view==='wine' ? <>
      <nav className="result-navigation" aria-label="Felfedett bor kiválasztása">
        <button className="button-secondary" disabled={selected<=0} onClick={()=>setSelected(i=>i-1)}>Előző bor</button>
        <label><span className="sr-only">Felfedett bor</span><select aria-label="Felfedett bor" value={wine.id} onChange={e=>setSelected(wines.findIndex(w=>w.id===e.target.value))}>
          {wines.map(w=><option key={w.id} value={w.id}>{String(w.position).padStart(2,'0')}. tétel</option>)}
        </select></label>
        <button className="button-secondary" disabled={selected>=wines.length-1} onClick={()=>setSelected(i=>i+1)}>Következő bor</button>
      </nav>
      <article className="result-wine" aria-label={`${wine.position}. bor eredménye`}>
        <ResultPhoto key={`${wine.id}:${wine.photoUpdatedAt}`} api={photos} gameId={gameId} wine={wine} />
        <div className="result-wine-content"><p className="eyebrow">{String(wine.position).padStart(2,'0')}. TÉTEL · FELFEDVE</p>
          <h3>{wine.name}</h3>
          <dl className="result-facts"><div><dt><CategoryIcon category="price" />Valódi palackár</dt><dd>{money(wine.priceHuf)}</dd><dd className="result-fact-note">{priceBucketLabel(wine.priceBucket)}</dd></div>
            <div><dt><CategoryIcon category="alcohol" />Alkoholtartalom</dt><dd>{alcohol(wine.alcoholTenths)}</dd></div>
            <div><dt><CategoryIcon category="liking" />Átlagos tetszés</dt><dd>{wine.averageLiking===null?'—':`${numeric(wine.averageLiking)} / 10`}</dd><dd className="result-fact-note">{wine.responseCount} értékelés</dd></div>
          </dl>
          {!!wine.questions?.length && <section className="question-results" aria-label="Egyedi kérdések eredménye">
            <h4>Egyedi kérdések</h4>
            <div className="question-grid">
              {wine.questions.map(q=>{
                const correct=q.options.find(o=>o.id===q.correctOptionId)?.label;
                const guess=q.options.find(o=>o.id===q.ownOptionId)?.label;
                return <article className="question-card" key={q.id}>
                  <h5>{q.prompt}</h5>
                  <ul>
                    {q.options.map(option=>{
                      const isCorrect=option.id===q.correctOptionId;
                      const isOwn=!presentation && selfId && option.id===q.ownOptionId;
                      return <li key={option.id} className={[isCorrect && 'is-correct', isOwn && 'is-own'].filter(Boolean).join(' ') || undefined}>
                        <span>{option.label}</span>
                        {isCorrect && <em>helyes</em>}
                        {isOwn && <em>a tipped</em>}
                      </li>;
                    })}
                  </ul>
                  <p>Helyes válasz: <strong>{correct}</strong></p>
                  {!presentation && selfId && <p>{q.ownOptionId ? <>A tipped: {guess} · <strong>{q.ownOptionId===q.correctOptionId?'Eltaláltad':'Nem talált'}</strong>{results.scoringVersion===3 ? (q.ownOptionId===q.correctOptionId?' · 1 pont':' · 0 pont') : ''}</> : 'Ehhez a kérdéshez nincs leadott válaszod.'}</p>}
                </article>;
              })}
            </div>
          </section>}
          {!presentation && selfId && <OwnComparison wine={wine} version={results.scoringVersion} />}
          {!presentation && <GuessCharts wine={wine} own={selfId ? wine.own : null} />}
          {presentation && <p className="result-public-note">A játékosonkénti tippek és a kategóriapontok a Ranglistán vannak. Az összesített tippek a Tippeloszlás nézetben.</p>}
        </div>
      </article>
    </> : <Ranking results={results} selfId={presentation ? null : selfId} page={page} setPage={setPage} pageSize={pageSize} compact={presentation} />}
  </section>;
}
function Ranking({ results, selfId, page, setPage, pageSize, compact = false }: {
  results: GameResults; selfId: string | null; page: number; setPage: (value: number | ((page: number) => number)) => void; pageSize: number; compact?: boolean;
}) {
  const [lens, setLens] = useState<'total' | ScoreLens>('total');
  const choose = (next: 'total' | ScoreLens) => { setLens(next); setPage(0); };
  const board = results.leaderboard;
  const podium = board.slice(0, 3);
  const order = [1, 0, 2].filter(index => podium[index]);
  const rest = board.slice(3);
  const listLength = lens === 'total' ? rest.length : board.length;
  const pages = Math.max(1, Math.ceil(listLength / pageSize));
  const max = Math.max(1, results.maxPoints);
  const category = lens === 'total' ? null : categoryMax(results, lens);
  return <section aria-label="Ranglista" className="results-ranking">
    <header className="podium-heading">
      <h3>{results.final ? 'Végső ranglista' : 'Állás a felfedett borok alapján'}</h3>
      {lens === 'questions' && results.scoringVersion !== 3 ? <p className="podium-max"><span>a válaszok látszanak, pont nélkül</span></p>
        : <p className="podium-max"><strong>{lens === 'total' ? results.maxPoints : category}</strong><span>{lensLabel(lens, results.final)}</span></p>}
    </header>
    <nav className="score-lenses" aria-label="Kategóriák">
      {([['total', 'Összes'], ['price', 'Ár'], ['alcohol', 'Alkohol'], ['questions', 'Kérdések']] as const).map(([id, label]) =>
        <button key={id} className={lens === id ? 'button-primary' : 'button-secondary'} aria-pressed={lens === id} onClick={() => choose(id)}>{label}</button>)}
    </nav>
    {board.length ? <>
      {lens === 'total' ? <>
        <ol className="podium" aria-label="Dobogó">
          {order.map(index => {
            const entry = podium[index];
            const card = results.scorecards[board.indexOf(entry)];
            const rise = compact
              ? (index === 0 ? 72 : 56) + Math.round(entry.points / max * 36)
              : (index === 0 ? 108 : 76) + Math.round(entry.points / max * 96);
            return <li key={entry.id} className={`podium-step podium-slot-${index + 1}${entry.id === selfId ? ' is-self' : ''}`}>
              <p className="podium-name">{entry.nickname}{entry.id === selfId ? ' · Te' : ''}</p>
              {!compact && card && <CategoryChips results={results} card={card} onSelect={choose} />}
              <div className="podium-plinth" style={{ height: rise }}>
                <span className="podium-place">{entry.rank}.</span>
                <strong>{entry.points}<small> / {results.maxPoints}</small></strong>
              </div>
            </li>;
          })}
        </ol>
        {rest.length > 0 && <ol className="ranking-rest" start={4}>
          {rest.slice(page * pageSize, (page + 1) * pageSize).map(entry => {
            const card = results.scorecards[board.indexOf(entry)];
            return <li key={entry.id} className={entry.id === selfId ? 'is-self' : undefined}>
              <span>{entry.rank}.</span>
              <span><span>{entry.nickname}{entry.id === selfId ? ' · Te' : ''}</span>{!compact && card && <CategoryChips results={results} card={card} onSelect={choose} />}</span>
              <strong>{entry.points}<small> / {results.maxPoints}</small></strong>
            </li>;
          })}
        </ol>}
      </> : <ScoreLenses results={results} selfId={selfId} lens={lens} page={page} pageSize={pageSize} />}
      {pages > 1 && <nav className="result-navigation" aria-label="Ranglista lapozása"><button className="button-secondary" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Előző oldal</button>
        <span>{page + 1} / {pages}</span><button className="button-secondary" disabled={page >= pages - 1} onClick={() => setPage(value => value + 1)}>Következő oldal</button></nav>}
    </> : <p>Még nincs résztvevő ebben a kóstolóban.</p>}
    <p className="small-note">Azonos pontszámhoz azonos helyezés tartozik. A tetszés nem befolyásolja a sorrendet. A kategóriák a felfedett borok tippjeit mutatják.</p>
  </section>;
}
function lensLabel(lens: 'total' | ScoreLens, final: boolean) {
  if (lens === 'price') return 'pont érhető el árból';
  if (lens === 'alcohol') return 'pont érhető el alkoholból';
  if (lens === 'questions') return 'pont érhető el a kérdésekből';
  return final ? 'pont volt elérhető' : 'pont érhető el most';
}
function pointText(points: number | null, simple: boolean) {
  if (points === null) return '—';
  return simple ? `${points} pont` : `${numeric(points)} / 50 pont${points === 50 ? ' · Pontos találat' : ''}`;
}
function OwnComparison({wine,version}:{wine:WineResult;version:1|2|3}) {
  const own=wine.own;
  const simple = version === 3;
  if(!own) return <div className="result-comparison"><h4>A saját eredményed</h4><p>Ehhez a borhoz nincs leadott tipped. <strong>0 pont.</strong></p></div>;
  const rows=[{label:version===1?'Palackár':'Árkategória',guess:version===1 && own.priceHuf!==null?money(own.priceHuf):own.priceBucket===null?'—':priceBucketLabel(own.priceBucket),
    truth:version===1?money(wine.priceHuf):priceBucketLabel(wine.priceBucket),points:own.pricePoints},
    {label:'Alkoholtartalom',guess:alcohol(own.alcoholTenths),truth:alcohol(wine.alcoholTenths),points:own.alcoholPoints}];
  return <section className="result-comparison" aria-label="Saját tipp és valódi érték">
    <div className="result-comparison-heading"><h4>A saját eredményed</h4><strong>{own.total===null?'Nem pontozható':simple?`${own.total} pont`:`${own.total} / 100 pont`}</strong></div>
    {rows.map(row=><div className="result-answer" key={row.label}><div className="result-answer-title"><h5>{row.label}</h5>
      <span>{pointText(row.points, simple)}</span></div>
      <dl><div><dt>Saját tipped</dt><dd>{row.guess}</dd></div><div><dt>Valódi érték</dt><dd>{row.truth}</dd></div></dl>
    </div>)}
    <p className="small-note">A te tetszésed: {own.liking}/10. Ez nem ad versenypontot.</p>
  </section>;
}
