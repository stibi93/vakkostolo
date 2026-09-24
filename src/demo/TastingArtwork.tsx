/** Code-native print illustration. The bottles deliberately carry no wine identity. */
export function TastingArtwork() {
  return (
    <div className="tasting-artwork" aria-hidden="true">
      <svg viewBox="0 0 440 350" fill="none" className="bottle-print">
        <g transform="rotate(-12 154 185)">
          <path d="m131 26 44 2-2 66c0 16 31 26 35 51l-3 164c-19 10-82 10-101 0l1-163c2-25 30-32 30-50l-4-70Z" fill="#25291f" />
          <path d="m130 31 46 1m-45 7 44 2m-43 48 41 2" stroke="#f7f3e5" strokeWidth="2" />
          <path d="m106 135 11-8 11 8 15-6 12 7 16-8 12 7 13-5 10 8-3 170-24 5-17-3-28 4-29-6 1-173Z" fill="#e4d9bd" stroke="#25291f" strokeWidth="2" />
          <path d="m120 151-7 135m22-144 5 145m47-144 8 132m-85 28 32-7 26 9 32-9" stroke="#b1a386" strokeWidth="1.5" />
          <path d="m112 185 86-5 1 72-88 6 1-73Z" fill="#f9f6ed" stroke="#25291f" strokeWidth="1.5" />
          <text x="119" y="238" className="bottle-label">01</text>
          <path d="m130 116 47-2" stroke="#25291f" strokeWidth="3" strokeLinecap="round" />
        </g>
        <g transform="rotate(13 275 177)">
          <path d="m253 12 45 1-2 77c0 15 27 31 32 58l-2 161c-30 12-76 10-104 0l2-162c3-27 28-39 28-56l1-79Z" fill="#25291f" />
          <path d="m252 19 46 2m-46 8 45 2m-45 48 42 2" stroke="#f7f3e5" strokeWidth="2" />
          <path d="m224 133 12-8 15 7 13-5 13 7 16-7 14 8 13-6 10 10-6 171-32 5-30-3-40 0 2-179Z" fill="#ea633c" stroke="#25291f" strokeWidth="2" />
          <path d="m237 146-6 143m28-146 4 146m44-147 8 145m-91 14 36-7 20 10 36-7" stroke="#a63a23" strokeWidth="1.5" />
          <path d="m231 174 88 5-2 78-89-3 3-80Z" fill="#f9f6ed" stroke="#25291f" strokeWidth="1.5" />
          <text x="240" y="239" className="bottle-label">?</text>
          <path d="m249 113 46 4" stroke="#25291f" strokeWidth="3" strokeLinecap="round" />
        </g>
        <path d="M50 320c53 6 80 5 127 1m71 11c46 4 77 2 112-1" stroke="#25291f" strokeWidth="2" strokeLinecap="round" />
        <path d="m35 125 43 19m-21-43 28 27m277 53 35-5m-38 21 28 9" stroke="#25291f" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span className="artwork-caption">a csomagolás most nem segít.</span>
    </div>
  );
}
