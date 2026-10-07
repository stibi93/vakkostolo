import { CategoryIcon } from '../rating/CategoryIcon';
import type { GameResults, Scorecard } from './model';

const format = (value: number) => value.toLocaleString('hu-HU', { maximumFractionDigits: 1 });

export function ScoreTable({ results, selfId }: { results: GameResults; selfId: string | null }) {
  const categories = summaryColumns(results);
  return <div className="score-table-wrap">
    <table className="score-table">
      <caption className="sr-only">Kategóriánkénti pontösszesítő</caption>
      <thead>
        <tr>
          <th rowSpan={2} scope="col">Hely</th>
          <th rowSpan={2} scope="col">Játékos</th>
          {categories.map(category => <th key={category.id} scope="col" className="score-head">
            <span className="score-category"><CategoryIcon category={category.icon} />{category.label}</span>
          </th>)}
          <th rowSpan={2} scope="col">Pont</th>
        </tr>
        <tr>{categories.map(category => <th key={category.id} scope="col" className="score-head">Összesen<small>{format(category.max)} pont</small></th>)}</tr>
      </thead>
      <tbody>{results.leaderboard.map((entry, index) => {
        const card = results.scorecards[index];
        return <tr key={entry.id} className={entry.id === selfId ? 'is-self' : undefined}>
          <td>{entry.rank}.</td>
          <th scope="row">{entry.nickname}{entry.id === selfId ? ' · Te' : ''}</th>
          {categories.map(category => {
            const sum = categorySum(card, category.id);
            return <td key={category.id} className="score-sum"><strong className={category.max > 0 && sum === category.max ? 'is-hit' : undefined}>{format(sum)}</strong></td>;
          })}
          <td><strong>{entry.points}<small> / {results.maxPoints}</small></strong></td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}

function summaryColumns(results: GameResults) {
  const perWine = results.scoringVersion >= 3 ? 1 : 50;
  const questionMax = results.scoringVersion >= 3 ? results.wines.reduce((sum, wine) => sum + (wine.questions?.length ?? 0), 0) : 0;
  return [
    { id: 'price' as const, label: 'Árkategória', icon: 'price' as const, max: results.revealedCount * perWine },
    { id: 'alcohol' as const, label: 'Alkoholfok', icon: 'alcohol' as const, max: results.revealedCount * perWine },
    { id: 'other' as const, label: 'Egyéb', icon: 'question' as const, max: questionMax },
  ];
}
function categorySum(card: Scorecard, id: 'price' | 'alcohol' | 'other') {
  return card.wines.reduce((sum, wine) => {
    if (id === 'price') return sum + (wine.pricePoints ?? 0);
    if (id === 'alcohol') return sum + (wine.alcoholPoints ?? 0);
    return sum + wine.questions.reduce((points, question) => points + question.points, 0);
  }, 0);
}
