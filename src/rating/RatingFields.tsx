import { CategoryIcon } from './CategoryIcon';
import { useId } from 'react';
import type { CSSProperties, FocusEvent } from 'react';
import { flushSync } from 'react-dom';
import { priceBuckets } from '../domain/game';
import { defaultAlcoholTenths, formatAlcohol, stepAlcohol } from './draft';
import type { RatingDraft } from './draft';
import './rating.css';

const likingScale = Array.from({ length: 10 }, (_, index) => index + 1);

/** Price range cards, half-degree alcohol stepper and 1–10 liking cards. */
export function RatingFields({ value, onChange }: { value: RatingDraft; onChange: (value: RatingDraft) => void }) {
  const id = useId();
  const set = (patch: Partial<RatingDraft>) => onChange({ ...value, ...patch });
  const placeholder = formatAlcohol(defaultAlcoholTenths);
  // Fill in the typical value on first touch and select it, so typing replaces it instead of appending.
  function fillPlaceholder(event: FocusEvent<HTMLInputElement>) {
    if (value.alcohol) return;
    const input = event.currentTarget;
    flushSync(() => set({ alcohol: placeholder }));
    input.select();
  }
  return <div className="rating-fields">
    <fieldset className="rating-group">
      <legend><CategoryIcon category="price" />Becsült ár</legend>
      <div className="rating-price-grid">
        {priceBuckets.map((bucket) => <label key={bucket.id} className="rating-choice rating-price">
          <input type="radio" name={`${id}-price`} value={bucket.id} checked={value.priceBucket === String(bucket.id)}
            onChange={() => set({ priceBucket: String(bucket.id) })} required />
          <span>{bucket.label}</span>
        </label>)}
      </div>
    </fieldset>

    <fieldset className="rating-group">
      <legend id={`${id}-alcohol-legend`}><CategoryIcon category="alcohol" />Becsült alkoholfok</legend>
      <div className="rating-stepper">
        <button type="button" className="rating-step" aria-label="Alkoholfok csökkentése fél fokkal"
          onClick={() => set({ alcohol: stepAlcohol(value.alcohol, -1) })}>−<small>0,5</small></button>
        <label className="rating-alcohol">
          <span className="sr-only">Becsült alkoholfok (% vol)</span>
          <input inputMode="decimal" autoComplete="off" value={value.alcohol} placeholder={placeholder}
            aria-describedby={`${id}-alcohol-hint`} onChange={(event) => set({ alcohol: event.target.value })}
            onFocus={fillPlaceholder} required />
          <span className="rating-unit" aria-hidden="true">% vol</span>
        </label>
        <button type="button" className="rating-step" aria-label="Alkoholfok növelése fél fokkal"
          onClick={() => set({ alcohol: stepAlcohol(value.alcohol, 1) })}>+<small>0,5</small></button>
      </div>
      <p className="small-note" id={`${id}-alcohol-hint`}>Fél fokonként léptethető, vagy írd be, például 13,5.</p>
    </fieldset>

    <fieldset className="rating-group">
      <legend><CategoryIcon category="liking" />Tetszés</legend>
      <div className="rating-liking-grid">
        {likingScale.map((score) => <label key={score} className="rating-choice rating-liking" style={{ '--level': (score - 1) / 9 } as CSSProperties}>
          <input type="radio" name={`${id}-liking`} value={score} checked={value.liking === String(score)}
            onChange={() => set({ liking: String(score) })} aria-label={`Tetszés: ${score} a 10-ből`} required />
          <span aria-hidden="true">{score}</span>
        </label>)}
      </div>
      <p className="rating-scale-ends" aria-hidden="true"><span>egyáltalán nem ízlik</span><span>nagyon ízlik</span></p>
      <p className="small-note">1: egyáltalán nem ízlik · 10: nagyon ízlik. A tetszés nem ad versenypontot.</p>
    </fieldset>
  </div>;
}
