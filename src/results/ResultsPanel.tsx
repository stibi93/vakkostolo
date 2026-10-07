import { CategoryIcon } from '../rating/CategoryIcon';
import { useRef, useState } from 'react';
import type { TouchEvent } from 'react';
import { ScoreTable } from './ScoreTable';
import { priceBucketLabel } from '../domain/game';
import type { GameResults, ResultPhotoApi, WineResult } from './model';
import { CountUp } from './CountUp';
import { GuessCharts } from './GuessCharts';
import { ResultPhoto } from './ResultPhoto';
import './results.css';
const numeric=(value:number)=>value.toLocaleString('hu-HU',{maximumFractionDigits:1});
const alcohol=(value:number)=>`${numeric(value/10)}% vol`;
const money=(value:number)=>`${value.toLocaleString('hu-HU')} Ft`;
const outOfTen=(value:number)=>`${numeric(value)} / 10`;
const podiumNames = 3;

export function ResultsPanel({ results, gameId, selfId, photos, presentation=false, roundIds, intro }: {
  results: GameResults; gameId:string; selfId:string|null; photos?:ResultPhotoApi; presentation?:boolean; roundIds?:string[]; intro?: { title:string; message:string };
}) {
  const wines = roundIds ? roundIds.flatMap(id => results.wines.filter(w => w.id === id)) : results.wines;
  const [selected,setSelected]=useState(roundIds ? 0 : wines.length-1);
  const [direction,setDirection]=useState<-1|0|1>(0);
  const [view,setView]=useState<'wine'|'guesses'|'ranking'>('wine');
  const touch=useRef<{x:number;y:number}|null>(null);
  const index=Math.min(selected,wines.length-1);
  const wine=wines[index];
  const self=results.leaderboard.find(e=>e.id===selfId);
  function go(step:-1|1) {
    const next=index+step;
    if(next<0 || next>=wines.length) return;
    setDirection(step); setSelected(next);
  }
  function swipeStart(event:TouchEvent) { const point=event.touches[0]; touch.current=point ? {x:point.clientX,y:point.clientY} : null; }
  function swipeEnd(event:TouchEvent) {
    const start=touch.current, point=event.changedTouches[0]; touch.current=null;
    if(!start || !point) return;
    const dx=point.clientX-start.x, dy=point.clientY-start.y;
    if(Math.abs(dx)>=56 && Math.abs(dx)>Math.abs(dy)*1.5) go(dx<0?1:-1);
  }
  if(!wine) return <p>Még nincs felfedett eredmény. A borok a játékmester felfedése után jelennek meg.</p>;
  return <section className={`results-panel${presentation?' results-presentation':''}`} aria-label="Kóstoló eredményei">
    <header className="results-heading"><div><p className="eyebrow">{intro ? 'FELFEDÉS / BEMUTATÓ' : results.final?'VÉGEREDMÉNY':'FELFEDETT EREDMÉNYEK'}</p>
      <h2>{intro?.title ?? (results.final?'A kóstoló eredménye':'Eddigi eredmények')}</h2>
      {intro?.message && <p className="live-break-message">{intro.message}</p>}
      {!presentation && <p>{results.revealedCount} felfedett bor · legfeljebb {results.maxPoints} pont</p>}</div>
      {!presentation && self && <div className="results-own-total"><strong><CountUp value={self.points} format={String} /></strong><span>pont összesen · {self.rank}. hely</span></div>}
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
        <button className="result-nav-step" disabled={index<=0} onClick={()=>go(-1)}><span aria-hidden="true">‹</span> Előző<span className="result-nav-word"> bor</span></button>
        <label className="result-nav-pick"><span className="sr-only">Felfedett bor</span><select aria-label="Felfedett bor" value={wine.id} onChange={e=>{const next=wines.findIndex(w=>w.id===e.target.value); setDirection(next>index?1:-1); setSelected(next);}}>
          {wines.map(w=><option key={w.id} value={w.id}>{String(w.position).padStart(2,'0')}. tétel</option>)}
        </select><span className="result-nav-count" aria-hidden="true">{index+1} / {wines.length}</span></label>
        <button className="result-nav-step" disabled={index>=wines.length-1} onClick={()=>go(1)}>Következő<span className="result-nav-word"> bor</span> <span aria-hidden="true">›</span></button>
      </nav>
      <article key={wine.id} className={`result-wine${direction ? (direction>0 ? ' from-next' : ' from-prev') : ''}`} aria-label={`${wine.position}. bor eredménye`}
        onTouchStart={swipeStart} onTouchEnd={swipeEnd}>
        <div className="result-photo-frame">
          <ResultPhoto key={`${wine.id}:${wine.photoUpdatedAt}`} api={photos} gameId={gameId} wine={wine} lift={presentation} />
          <span className="reveal-strip" aria-hidden="true"><span>{String(wine.position).padStart(2,'0')}</span></span>
        </div>
        <div className="result-wine-content"><p className="eyebrow">{String(wine.position).padStart(2,'0')}. TÉTEL · FELFEDVE</p>
          <h3>{wine.name}</h3>
          <dl className="result-facts"><div><dt><CategoryIcon category="price" />Valódi palackár</dt><dd><CountUp value={wine.priceHuf} format={money} delay={450} /></dd><dd className="result-fact-note">{priceBucketLabel(wine.priceBucket)}</dd></div>
            <div><dt><CategoryIcon category="alcohol" />Alkoholtartalom</dt><dd><CountUp value={wine.alcoholTenths} format={alcohol} delay={550} /></dd></div>
            <div><dt><CategoryIcon category="liking" />Átlagos tetszés</dt><dd>{wine.averageLiking===null?'—':<CountUp value={wine.averageLiking} format={outOfTen} step={0.1} delay={650} />}</dd><dd className="result-fact-note">{wine.responseCount} értékelés</dd></div>
            {!presentation && selfId && <div><dt><CategoryIcon category="liking" />Saját tetszés</dt><dd>{wine.own ? outOfTen(wine.own.liking) : '—'}</dd><dd className="result-fact-note">{wine.own ? 'Nem ad versenypontot.' : 'Nincs leadott tetszés.'}</dd></div>}
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
  // Tied players share a step, so the steps follow the distinct ranks (1, 1, 3 → steps 1 and 3).
  const tiers = [...new Set(board.map(entry => entry.rank))].sort((a, b) => a - b).slice(0, 3);
  return <section aria-label="Ranglista" className={`results-ranking${compact ? ' is-compact' : ''}`}>
    <header className="podium-heading">
      <h3>{results.final ? 'Végső ranglista' : 'Állás a felfedett borok alapján'}</h3>
      <p className="podium-max"><strong>{results.maxPoints}</strong> <span>{results.final ? 'pont volt elérhető' : 'pont érhető el most'}</span></p>
    </header>
    {board.length ? <>
      <ol className="podium" aria-label="Dobogó">
        {[2, 1, 3].map(slot => {
          const rank = tiers[slot - 1];
          const people = rank === undefined ? [] : board.filter(entry => entry.rank === rank);
          const shown = people.slice(0, podiumNames);
          const points = people[0]?.points;
          return <li key={slot} className={`podium-step podium-slot-${slot}${people.some(entry => entry.id === selfId) ? ' is-self' : ''}${people.length === 0 ? ' is-empty' : ''}`}>
            <p className="podium-name">{shown.map((entry, index) => <span key={entry.id}>{index > 0 ? '\u00a0· ' : ''}{entry.nickname}{entry.id === selfId ? ' · Te' : ''}</span>)}
              {people.length > shown.length && <span className="podium-more"> +{people.length - shown.length} további</span>}</p>
            <div className="podium-plinth">
              {rank !== undefined && <span className="podium-place">{rank}.</span>}
              {points !== undefined && <strong><CountUp value={points} format={numeric} delay={300 + slot * 120} /><small> / {results.maxPoints}</small></strong>}
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
function OwnComparison({wine,version}:{wine:WineResult;version:GameResults['scoringVersion']}) {
  const own=wine.own;
  const simple = version >= 3;
  if(!own) return <div className="result-comparison"><h4>A saját eredményed</h4><p>Ehhez a borhoz nincs leadott tipped. <strong>0 pont.</strong></p></div>;
  const rows=[{label:version===1?'Palackár':'Árkategória',guess:version===1 && own.priceHuf!==null?money(own.priceHuf):own.priceBucket===null?'—':priceBucketLabel(own.priceBucket),
    truth:version===1?money(wine.priceHuf):priceBucketLabel(wine.priceBucket),points:own.pricePoints},
    {label:'Alkoholtartalom',guess:alcohol(own.alcoholTenths),truth:alcohol(wine.alcoholTenths),points:own.alcoholPoints}];
  return <section className="result-comparison" aria-label="Saját tipp és valódi érték">
    <div className="result-comparison-heading"><h4>A saját eredményed</h4><strong>{own.total===null?'Nem pontozható':<CountUp value={own.total} format={simple?v=>`${v} pont`:v=>`${v} / 100 pont`} delay={800} />}</strong></div>
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
function QuestionAnswers({ wine, version, showOwn }: { wine: WineResult; version: GameResults['scoringVersion']; showOwn: boolean }) {
  return <section className="result-questions" aria-label="Egyedi kérdések eredménye">
    <h4>Egyedi kérdések</h4>
    {wine.questions?.map(q => {
      const correct = q.options.find(o => o.id === q.correctOptionId)?.label ?? '—';
      const guess = q.options.find(o => o.id === q.ownOptionId)?.label;
      const points = version >= 3 ? (q.ownOptionId === q.correctOptionId ? 1 : 0) : null;
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
