import { CategoryIcon } from '../rating/CategoryIcon';
import { useState } from 'react';
import { priceBucketLabel } from '../domain/game';
import type { GameResults, ResultPhotoApi, WineResult } from './model';
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
  const [view,setView]=useState<'wine'|'ranking'>('wine');
  const [page,setPage]=useState(0);
  const wine=wines[Math.min(selected,wines.length-1)];
  const self=results.leaderboard.find(e=>e.id===selfId);
  const pageSize=presentation?5:50, pages=Math.max(1,Math.ceil(results.leaderboard.length/pageSize));
  if(!wine) return <p>Még nincs felfedett eredmény. A borok a játékmester felfedése után jelennek meg.</p>;
  return <section className={`results-panel${presentation?' results-presentation':''}`} aria-label="Kóstoló eredményei">
    <header className="results-heading"><div><p className="eyebrow">{intro ? 'FELFEDÉS / BEMUTATÓ' : results.final?'VÉGEREDMÉNY':'FELFEDETT EREDMÉNYEK'}</p>
      <h2>{intro?.title ?? (results.final?'A kóstoló eredménye':'Eddigi eredmények')}</h2>
      {intro?.message && <p className="live-break-message">{intro.message}</p>}
      <p>{intro && `${wines.length} bemutatott bor · összesen `}{results.revealedCount} felfedett bor · legfeljebb {results.maxPoints} pont</p></div>
      {!presentation && self && <div className="results-own-total"><strong>{self.points}</strong><span>pont összesen · {self.rank}. hely</span></div>}
    </header>
    {!results.final && <p className="small-note">Csak a már felfedett borok számítanak bele. A sorrend a következő felfedéskor változhat.</p>}
    {results.leaderboard.some(e=>e.unscored>0) && <p className="auth-message">Egy régi pontozású válaszból hiányzik a forintos ártipp. Ez a válasz nem pontozható; az összesítés hiányos.</p>}
    <nav className="results-switch" aria-label="Eredménynézet">
      <button className={view==='wine'?'button-primary':'button-secondary'} aria-pressed={view==='wine'} onClick={()=>setView('wine')}>Borlapok</button>
      <button className={view==='ranking'?'button-primary':'button-secondary'} aria-pressed={view==='ranking'} onClick={()=>setView('ranking')}>Ranglista</button>
    </nav>
    {view==='wine' ? <>
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
          {!presentation && selfId && <OwnComparison wine={wine} version={results.scoringVersion} />}
          {presentation && <p className="result-public-note">A saját tippedet és pontjaidat a telefonodon láthatod.</p>}
        </div>
      </article>
      {!presentation && <details className="result-rules"><summary>Hogyan számoljuk a pontokat?</summary>
        <p>{results.scoringVersion===2?'Ár: a pontos kategória 50 pont, a szomszédos 25 pont, minden más 0 pont.':'Ár: pontos forintos tippért 50 pont jár; a valódi árhoz képesti eltéréssel arányosan csökken, 100% eltéréstől 0.'}</p>
        <p>Alkohol: pontos tippért 50 pont jár, az eltéréssel arányosan csökken; 3 százalékpont eltéréstől 0 pont. Az összpontot a végén egészre kerekítjük.</p>
        <p>A tetszés nem versenypont. Hiányzó válaszért 0 pont jár, a tetszési átlagba nem számít bele.</p>
      </details>}
    </> : <section aria-label="Ranglista" className="results-ranking">
      <h3>{results.final?'Végső ranglista':'Állás a felfedett borok alapján'}</h3>
      {results.leaderboard.length ? <table><thead><tr><th scope="col">Hely</th><th scope="col">Játékos</th><th scope="col">Pont</th></tr></thead>
        <tbody>{results.leaderboard.slice(page*pageSize,(page+1)*pageSize).map(e=><tr key={e.id} className={!presentation && e.id===selfId?'is-self':undefined}>
          <td>{e.rank}.</td><th scope="row">{e.nickname}{!presentation && e.id===selfId?' · Te':''}<small>#{String(e.seat).padStart(2,'0')} · {e.answered}/{results.revealedCount} válasz</small></th>
          <td><strong>{e.points}</strong>{e.unscored>0 && <small>hiányos</small>}</td>
        </tr>)}</tbody></table> : <p>Még nincs résztvevő ebben a kóstolóban.</p>}
      {pages>1 && <nav className="result-navigation" aria-label="Ranglista lapozása"><button className="button-secondary" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Előző oldal</button>
        <span>{page+1} / {pages}</span><button className="button-secondary" disabled={page>=pages-1} onClick={()=>setPage(p=>p+1)}>Következő oldal</button></nav>}
      <p className="small-note">Azonos pontszámhoz azonos helyezés tartozik. A tetszés nem befolyásolja a sorrendet.</p>
    </section>}
  </section>;
}
function OwnComparison({wine,version}:{wine:WineResult;version:1|2}) {
  const own=wine.own;
  if(!own) return <div className="result-comparison"><h4>A saját eredményed</h4><p>Ehhez a borhoz nincs leadott tipped. <strong>0 pont.</strong></p></div>;
  const rows=[{label:version===2?'Árkategória':'Palackár',guess:version===1 && own.priceHuf!==null?money(own.priceHuf):own.priceBucket===null?'—':priceBucketLabel(own.priceBucket),
    truth:version===2?priceBucketLabel(wine.priceBucket):money(wine.priceHuf),points:own.pricePoints},
    {label:'Alkoholtartalom',guess:alcohol(own.alcoholTenths),truth:alcohol(wine.alcoholTenths),points:own.alcoholPoints}];
  return <section className="result-comparison" aria-label="Saját tipp és valódi érték">
    <div className="result-comparison-heading"><h4>A saját eredményed</h4><strong>{own.total===null?'Nem pontozható':`${own.total} / 100 pont`}</strong></div>
    {rows.map(row=><div className="result-answer" key={row.label}><div className="result-answer-title"><h5>{row.label}</h5>
      <span>{row.points===null?'—':numeric(row.points)} / 50 pont{row.points===50?' · Pontos találat':''}</span></div>
      <dl><div><dt>Saját tipped</dt><dd>{row.guess}</dd></div><div><dt>Valódi érték</dt><dd>{row.truth}</dd></div></dl>
    </div>)}
    <p className="small-note">A te tetszésed: {own.liking}/10. Ez nem ad versenypontot.</p>
  </section>;
}
