import { CategoryIcon } from '../rating/CategoryIcon';
import { priceBucketLabel } from '../domain/game';
import type { GameResults, Scorecard, WineResult } from './model';
import { categoryMax, categoryPoints, type ScoreLens } from './scorecard';
const format = (value: number) => value.toLocaleString('hu-HU', { maximumFractionDigits: 1 });
const alcohol = (tenths: number) => `${format(tenths / 10)}% vol`;

export function CategoryChips({ results, card, onSelect }: { results: GameResults; card: Scorecard; onSelect: (lens: ScoreLens) => void }) {
  const lenses = [['price', 'Ár', 'price'], ['alcohol', 'Alkohol', 'alcohol'], ['questions', 'Kérdés', 'question']] as const;
  return <div className="score-chips">{lenses.map(([id, label, icon]) => {
    if (id === 'questions' && results.wines.every(wine => !wine.questions?.length)) return null;
    const max = categoryMax(results, id);
    return <button type="button" className="score-chip" key={id} onClick={() => onSelect(id)}>
      <CategoryIcon category={icon} /><span>{label}</span><strong>{format(categoryPoints(card, id))}{max > 0 ? ` / ${format(max)}` : ''}</strong>
    </button>;
  })}</div>;
}

export function ScoreLenses({ results, selfId, lens, page, pageSize }: {
  results: GameResults; selfId: string | null; lens: ScoreLens; page: number; pageSize: number;
}) {
  const questionCount = results.wines.reduce((sum, wine) => sum + (wine.questions?.length ?? 0), 0);
  if (lens === 'questions' && questionCount === 0) return <p>Ehhez a kóstolóhoz nem volt egyedi kérdés.</p>;
  const rows = results.leaderboard.map((entry, index) => ({ entry, card: results.scorecards[index] }))
    .sort((a, b) => categoryPoints(b.card, lens) - categoryPoints(a.card, lens) || a.entry.rank - b.entry.rank || a.entry.seat - b.entry.seat);
  const visible = rows.slice(page * pageSize, (page + 1) * pageSize);
  if (lens === 'questions') return <div className="score-board">
    {results.scoringVersion !== 3 && <p className="small-note">Ezen a kóstolón az egyedi kérdés nem ad pontot. A válaszok így is látszanak.</p>}
    <ol className="score-question-rank">
      {visible.map(({ entry, card }, index) => <li key={entry.id} className={entry.id === selfId ? 'is-self' : undefined}>
        <span>{page * pageSize + index + 1}.</span>
        <span>{entry.nickname}{entry.id === selfId ? ' · Te' : ''}</span>
        <strong>{format(categoryPoints(card, 'questions'))}{categoryMax(results, 'questions') > 0 ? ` / ${format(categoryMax(results, 'questions'))}` : ''}</strong>
      </li>)}
    </ol>
    {results.wines.map(wine => wine.questions?.map(question => <article className="score-question" key={`${wine.id}:${question.id}`}>
      <h4>{String(wine.position).padStart(2, '0')}. tétel · {question.prompt}</h4>
      <p>Helyes válasz: <strong>{question.options.find(option => option.id === question.correctOptionId)?.label}</strong></p>
      <ul>{visible.map(({ entry, card }) => {
        const pick = card.wines.find(row => row.id === wine.id)?.questions.find(item => item.id === question.id);
        const label = question.options.find(option => option.id === pick?.optionId)?.label;
        const missing = !pick || pick.optionId === null;
        const hit = pick?.optionId === question.correctOptionId;
        return <li key={entry.id} className={!missing && hit ? 'is-hit' : undefined}>
          <span>{entry.nickname}{entry.id === selfId ? ' · Te' : ''}</span>
          <span>{label ?? 'nem tippelt'}</span>
          <strong>{missing ? 'nincs válasz' : results.scoringVersion === 3 ? `${pick.points} pont` : hit ? 'találat' : 'mellé'}</strong>
        </li>;
      })}</ul>
    </article>))}
  </div>;
  return <div className="score-board">
    <ol className="score-truths" aria-label="Helyes értékek">{results.wines.map(wine => <li key={wine.id}>
      <span>{String(wine.position).padStart(2, '0')}</span>{truth(wine, lens)}
    </li>)}</ol>
    <ol className="score-players">{visible.map(({ entry, card }, index) => <li key={entry.id} className={entry.id === selfId ? 'is-self' : undefined}>
      <header><span>{page * pageSize + index + 1}. {entry.nickname}{entry.id === selfId ? ' · Te' : ''}</span>
        <strong>{format(categoryPoints(card, lens))} / {format(categoryMax(results, lens))}</strong></header>
      <div className="score-stamps">{results.wines.map(wine => {
        const row = card.wines.find(item => item.id === wine.id);
        const points = lens === 'price' ? row?.pricePoints : row?.alcoholPoints;
        const hit = points === (results.scoringVersion === 3 ? 1 : 50);
        return <article key={wine.id} className={hit ? 'score-stamp is-hit' : points && points > 0 ? 'score-stamp is-partial' : 'score-stamp'}>
          <span>{String(wine.position).padStart(2, '0')}. tétel</span>
          <strong>{guess(row, lens)}</strong>
          <em>{points === null || points === undefined ? '0 pont' : `${format(points)} pont`}</em>
        </article>;
      })}</div>
    </li>)}</ol>
  </div>;
}
function truth(wine: WineResult, lens: ScoreLens) {
  return lens === 'price' ? priceBucketLabel(wine.priceBucket) : alcohol(wine.alcoholTenths);
}
function guess(row: Scorecard['wines'][number] | undefined, lens: ScoreLens) {
  if (!row || (lens === 'price' ? row.pricePoints : row.alcoholPoints) === null && row.liking === null) return 'nem tippelt';
  if (lens === 'price') return row.priceHuf !== null ? `${row.priceHuf.toLocaleString('hu-HU')} Ft` : row.priceBucket === null ? 'nem tippelt' : priceBucketLabel(row.priceBucket);
  return row.alcoholTenths === null ? 'nem tippelt' : alcohol(row.alcoholTenths);
}
