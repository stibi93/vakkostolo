import { CategoryIcon } from '../rating/CategoryIcon';
import { useState } from 'react';
import { ScoreTable } from './ScoreTable';
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
  const wine=wines[Math.min(selected,wines.length-1)];
  const self=results.leaderboard.find(e=>e.id===selfId);
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
        <ResultPhoto key={`${wine.id}:${wine.photoUpdatedAt}`} api={photos} gameId={gameId} wine={wine} lift={presentation} />
        <div className="result-wine-content"><p className="eyebrow">{String(wine.position).padStart(2,'0')}. TÉTEL · FELFEDVE</p>
          <h3>{wine.name}</h3>
          <dl className="result-facts"><div><dt><CategoryIcon category="price" />Valódi palackár</dt><dd>{money(wine.priceHuf)}</dd><dd className="result-fact-note">{priceBucketLabel(wine.priceBucket)}</dd></div>
            <div><dt><CategoryIcon category="alcohol" />Alkoholtartalom</dt><dd>{alcohol(wine.alcoholTenths)}</dd></div>
            <div><dt><CategoryIcon category="liking" />Átlagos tetszés</dt><dd>{wine.averageLiking===null?'—':`${numeric(wine.averageLiking)} / 10`}</dd><dd className="result-fact-note">{wine.responseCount} értékelés</dd></div>
            {!presentation && selfId && <div><dt><CategoryIcon category="liking" />Saját tetszés</dt><dd>{wine.own ? `${wine.own.liking} / 10` : '—'}</dd><dd className="result-fact-note">{wine.own ? 'Nem ad versenypontot.' : 'Nincs leadott tetszés.'}</dd></div>}
          </dl>
          {!presentation && selfId && <OwnComparison wine={wine} version={results.scoringVersion} />}
          {!!wine.questions?.length && (presentation
            ? <QuestionCards wine={wine} />
            : <QuestionAnswers wine={wine} version={results.scoringVersion} showOwn={!!selfId} />)}
          {presentation && <p className="result-public-note">A játékosonkénti tippek és a kategóriapontok a Ranglistán vannak. Az összesített tippek a Tippeloszlás nézetben.</p>}
        </div>
      </article>
    </> : <Ranking results={results} selfId={presentation ? null : selfId} compact={presentation} />}
  </section>;
}
function Ranking({ results, selfId, compact = false }: { results: GameResults; selfId: string | null; compact?: boolean }) {
  const board = results.leaderboard;
  const max = Math.max(1, results.maxPoints);
  return <section aria-label="Ranglista" className="results-ranking">
    <header className="podium-heading">
      <h3>{results.final ? 'Végső ranglista' : 'Állás a felfedett borok alapján'}</h3>
      <p className="podium-max"><strong>{results.maxPoints}</strong><span>{results.final ? 'pont volt elérhető' : 'pont érhető el most'}</span></p>
    </header>
    {board.length ? <>
      <ol className="podium" aria-label="Dobogó">
        {[2, 1, 3].map(place => {
          const people = board.filter(entry => entry.rank === place);
          const points = people[0]?.points;
          const rise = people.length === 0
            ? (compact ? 76 : 96)
            : (compact ? (place === 1 ? 92 : 76) : (place === 1 ? 120 : 96)) + Math.round((points ?? 0) / max * (compact ? 28 : 72));
          return <li key={place} className={`podium-step podium-slot-${place}${people.some(entry => entry.id === selfId) ? ' is-self' : ''}${people.length === 0 ? ' is-empty' : ''}`}>
            <p className="podium-name">{people.length ? people.map((entry, index) => <span key={entry.id}>{index > 0 ? ' · ' : ''}{entry.nickname}{entry.id === selfId ? ' · Te' : ''}</span>) : <span>—</span>}</p>
            <div className="podium-plinth" style={{ height: rise }}>
              <span className="podium-place">{place}.</span>
              <strong>{points === undefined ? '—' : <>{points}<small> / {results.maxPoints}</small></>}</strong>
            </div>
          </li>;
        })}
      </ol>
      <ScoreTable results={results} selfId={selfId} />
    </> : <p>Még nincs résztvevő ebben a kóstolóban.</p>}
    <p className="small-note">Azonos pontszámhoz azonos helyezés tartozik, a nevek egy dobogófokon állnak. A tetszés nem befolyásolja a sorrendet.</p>
  </section>;
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
  </section>;
}
function QuestionCards({ wine }: { wine: WineResult }) {
  return <section className="question-results" aria-label="Egyedi kérdések eredménye">
    <h4>Egyedi kérdések</h4>
    <div className="question-grid">
      {wine.questions?.map(q => {
        const correct = q.options.find(o => o.id === q.correctOptionId)?.label;
        return <article className="question-card" key={q.id}>
          <h5>{q.prompt}</h5>
          <ul>
            {q.options.map(option => {
              const isCorrect = option.id === q.correctOptionId;
              return <li key={option.id} className={isCorrect ? 'is-correct' : undefined}>
                <span>{option.label}</span>
                {isCorrect && <em>helyes</em>}
              </li>;
            })}
          </ul>
          <p>Helyes válasz: <strong>{correct}</strong></p>
        </article>;
      })}
    </div>
  </section>;
}
function QuestionAnswers({ wine, version, showOwn }: { wine: WineResult; version: 1 | 2 | 3; showOwn: boolean }) {
  return <section className="result-questions" aria-label="Egyedi kérdések eredménye">
    <h4>Egyedi kérdések</h4>
    {wine.questions?.map(q => {
      const correct = q.options.find(o => o.id === q.correctOptionId)?.label ?? '—';
      const guess = q.options.find(o => o.id === q.ownOptionId)?.label;
      const points = version === 3 ? (q.ownOptionId === q.correctOptionId ? 1 : 0) : null;
      return <div className="result-answer" key={q.id}>
        <div className="result-answer-title"><h5>{q.prompt}</h5>{points !== null && <span>{points} pont</span>}</div>
        <dl>
          {showOwn && <div><dt>Saját tipped</dt><dd>{guess ?? '—'}</dd></div>}
          <div><dt>Valódi érték</dt><dd>{correct}</dd></div>
        </dl>
        {showOwn && !q.ownOptionId && <p className="small-note">Ehhez a kérdéshez nincs leadott válaszod.</p>}
      </div>;
    })}
  </section>;
}
