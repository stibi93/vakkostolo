/** Decorative category cues: labels remain the accessible names. */
export function CategoryIcon({ category }: { category: 'price' | 'alcohol' | 'liking' }) {
  return <svg className="rating-category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {category === 'price' ? <><path d="M3 3h8l10 10-8 8L3 11Z" /><circle cx="7.5" cy="7.5" r="1" /></>
      : category === 'alcohol' ? <><path d="m5 19 14-14" /><circle cx="7" cy="7" r="3" /><circle cx="17" cy="17" r="3" /></>
      : <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />}
  </svg>;
}
