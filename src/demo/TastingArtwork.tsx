/** Neutral, numbered samples; the illustration never identifies a wine. */
export function TastingArtwork() {
  return (
    <div className="tasting-artwork" aria-hidden="true">
      <svg viewBox="0 0 180 170" fill="none" className="bottle-print">
        <g stroke="currentColor" strokeWidth="1.3">
          <path d="M36 16h18v34c0 12 16 16 16 34v69H20V84c0-18 16-22 16-34V16Z" />
          <path d="M36 24h18M20 89h50m-50 42h50" />
          <path d="M122 8h18v34c0 12 16 16 16 34v77h-50V76c0-18 16-22 16-34V8Z" />
          <path d="M122 16h18m-34 73h50m-50 42h50" />
          <path d="M8 160h160" stroke="var(--line)" />
        </g>
        <g fill="currentColor" fontFamily="Georgia, serif" fontSize="24" textAnchor="middle">
          <text x="45" y="119">01</text><text x="131" y="119">02</text>
        </g>
      </svg>
      <span className="artwork-caption">számozott mintaborok</span>
    </div>
  );
}
