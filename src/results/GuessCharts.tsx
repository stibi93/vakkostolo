import { priceBucketLabel, priceBuckets } from '../domain/game';
import type { OwnResult, WineResult } from './model';
import { alcoholScale } from './scale';

const alcoholLabel = (tenths: number) => `${(tenths / 10).toLocaleString('hu-HU', { maximumFractionDigits: 1 })}% vol`;
const tippCount = (count: number) => `${count} tipp`;

type Mark = { key: string; label: string; count: number; correct: boolean; own: boolean };

function shown(items: Mark[]) {
  return items.filter(item => item.correct || item.own || item.count > 0);
}

function Tally({ items, empty }: { items: Mark[]; empty: string }) {
  const rows = shown(items);
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const max = Math.max(1, ...rows.map(item => item.count));
  if (!rows.length) return <p className="guess-empty">{empty}</p>;
  return <ul className="guess-tally">
    {rows.map(item => <li key={item.key} className={[item.correct && 'is-correct', item.own && 'is-own'].filter(Boolean).join(' ') || undefined}>
      <span className="guess-name">{item.label}</span>
      <span className="guess-meter" aria-hidden="true"><span style={{ width: `${item.count / max * 100}%` }} /></span>
      <strong className="guess-n">{tippCount(item.count)}</strong>
      <span className="guess-tags">
        {item.correct && <span>helyes</span>}
        {item.own && <span>a te tipped</span>}
      </span>
    </li>)}
    {total === 0 && <li className="guess-note">Még senki nem tippelt.</li>}
  </ul>;
}

function lead(correctLabel: string, correctCount: number, total: number) {
  if (total === 0) return `Helyes érték: ${correctLabel}. Még nincs tipp.`;
  return `Helyes érték: ${correctLabel}. ${correctCount} a ${total} tippből ide esett.`;
}

/** Where people guessed. Empty categories stay hidden so the list stays readable. */
export function GuessCharts({ wine, own, presentation = false }: { wine: WineResult; own: OwnResult | null; presentation?: boolean }) {
  const alcohol = alcoholScale(wine.guesses.alcohol, wine.alcoholTenths);
  const priceItems: Mark[] = priceBuckets.map((bucket, index) => ({
    key: String(bucket.id), label: priceBucketLabel(bucket.id),
    count: wine.guesses.price[index] ?? 0, correct: wine.priceBucket === bucket.id, own: own?.priceBucket === bucket.id,
  }));
  const alcoholItems: Mark[] = alcohol.map(point => ({
    key: String(point.tenths), label: alcoholLabel(point.tenths),
    count: point.count, correct: point.tenths === wine.alcoholTenths, own: own?.alcoholTenths === point.tenths,
  }));
  const likingItems: Mark[] = wine.guesses.liking.map((count, index) => ({
    key: String(index + 1), label: `${index + 1} / 10`,
    count, correct: false, own: own?.liking === index + 1,
  }));
  const priceTotal = priceItems.reduce((sum, item) => sum + item.count, 0);
  const alcoholTotal = alcoholItems.reduce((sum, item) => sum + item.count, 0);
  const priceCorrect = priceItems.find(item => item.correct);
  const alcoholCorrect = alcoholItems.find(item => item.correct);
  return <section className={`guess-board${presentation ? ' guess-board-stage' : ''}`} aria-label="Tippeloszlás">
    <p className="guess-legend">Csak azok a tippek látszanak, amiket valaki beírt, plusz a helyes érték.</p>
    <article className="guess-panel">
      <header><h4>Árkategória</h4></header>
      <p className="guess-lead">{lead(priceBucketLabel(wine.priceBucket), priceCorrect?.count ?? 0, priceTotal)}</p>
      <Tally items={priceItems} empty="Nincs árkategória-tipp." />
    </article>
    <article className="guess-panel">
      <header><h4>Alkoholtartalom</h4></header>
      <p className="guess-lead">{lead(alcoholLabel(wine.alcoholTenths), alcoholCorrect?.count ?? 0, alcoholTotal)}</p>
      <Tally items={alcoholItems} empty="Nincs alkoholtipp." />
    </article>
    {wine.questions?.map(question => {
      const options: Mark[] = question.options.map(option => ({
        key: option.id, label: option.label, count: option.count,
        correct: option.id === question.correctOptionId, own: own !== null && question.ownOptionId === option.id,
      }));
      const correct = options.find(item => item.correct);
      const total = options.reduce((sum, item) => sum + item.count, 0);
      return <article className="guess-panel guess-panel-question" key={question.id}>
        <header><h4>{question.prompt}</h4></header>
        <p className="guess-lead">{lead(correct?.label ?? '—', correct?.count ?? 0, total)}</p>
        <Tally items={options} empty="Erre a kérdésre nincs válasz." />
      </article>;
    })}
    <article className="guess-panel">
      <header>
        <h4>Tetszés</h4>
        <p>{wine.averageLiking === null ? 'még nincs átlag' : `átlag ${wine.averageLiking.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} / 10`}</p>
      </header>
      <Tally items={likingItems} empty="Még nincs tetszés." />
      <p className="small-note">A tetszés nem versenypont.</p>
    </article>
  </section>;
}
