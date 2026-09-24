import { useEffect, useRef, useState } from 'react';
import type { AmbientMotion } from './useAmbientMotion';
import './harvest.css';

/** Original decorative SVG still life; never represents a wine in the game. */
export function HarvestArtwork({ motion }: { motion: AmbientMotion }) {
  const stage = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (stage.current) observer.observe(stage.current);
    return () => {
      observer.disconnect();
    };
  }, []);

  const running = motion.running && visible;
  return <div ref={stage} className={`harvest-artwork${running ? ' harvest-running' : ''}`}>
    <div className="harvest-scene" aria-hidden="true">
      <div className="harvest-light" />
      <div className="harvest-breeze">
        <svg viewBox="0 0 600 600" fill="none" focusable="false">
          <path d="M44 213C132 125 238 276 314 216S421 137 519 173" stroke="#517c8b" strokeWidth="3" />
          <path d="M12 242C124 175 206 304 297 253S439 175 565 206" stroke="#a96864" strokeWidth="2" />
          <path d="M72 180c18-26 42-29 63-20-15 26-37 31-63 20Z" fill="#738e70" />
          <path d="M443 289c23-9 46-4 58 16-28 9-47 4-58-16Z" fill="#a96864" />
          <path d="M370 103c-6-24 5-44 28-54 7 24-4 43-28 54Z" fill="#8c668d" />
        </svg>
      </div>
      <svg className="harvest-still-life" viewBox="0 0 600 600" fill="none" focusable="false">
        <g className="harvest-landscape" stroke="currentColor" strokeWidth="1.5">
          <path d="M-30 493C114 383 251 475 338 455S498 361 639 403M-15 516C136 418 239 496 351 477S514 391 621 426M-10 543C156 450 248 524 364 501S518 422 630 452M-20 574C148 482 275 550 387 527S544 451 629 482M-5 602C160 513 279 580 409 555S544 484 625 512" />
          <path d="m30 481 5 18m21-30 5 18m24-27 4 18m24-22 3 17m24-18 1 17m27-17-1 18m26-14-2 17m310-69 4 18m21-24 4 18m23-24 3 18m23-22 2 18" />
        </g>
        <ellipse cx="333" cy="532" rx="161" ry="14" fill="var(--accent)" opacity=".08" />
        <g transform="rotate(9 365 305)" stroke="var(--ink)" strokeWidth="2.5" strokeLinejoin="round">
          <path d="M346 93h43l-2 91c-1 23 41 31 43 66l-2 242c0 14-10 22-23 23h-80c-13-1-22-9-22-23l2-242c0-34 42-43 41-66Z" fill="var(--accent)" />
          <path d="m345 94 45 1-1 34-45-1Z" fill="var(--ink)" />
          <path d="m353 105 28 1m-28 7 28 1" stroke="var(--paper)" strokeWidth="1" opacity=".6" />
          <path d="M356 144v40c0 29-38 44-38 67v38m0 159v38c0 12 4 17 12 18" stroke="var(--paper)" opacity=".5" strokeLinecap="round" />
          <path d="m304 299 125 3-1 132-124-3Z" fill="var(--paper)" />
          <path d="m317 314 98 2m-98 100 98 2" strokeWidth="1" />
          <text x="361" y="390" textAnchor="middle" fill="var(--accent)" stroke="none" fontFamily="var(--display)" fontWeight="600" fontSize="81" letterSpacing="-6">01</text>
          <path d="m290 385 149-12 2 27-149 12Z" fill="var(--sheet)" strokeWidth="1.5" />
          <path d="m343 394 49-4" stroke="var(--accent)" strokeWidth="2" />
        </g>
        <g stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M136 314c-10 36-14 81 6 109 10 15 27 23 44 23s35-8 45-24c18-30 14-69 4-108Z" fill="var(--sheet)" fillOpacity=".75" />
          <path d="M130 369c1 29 7 65 56 67 38-2 52-30 54-62-35 11-68-14-110-5Z" fill="var(--accent)" stroke="none" />
          <path d="M136 314c27 8 68 8 99 0M186 448l-1 73m-39 13c10-7 27-9 39-13 13 4 31 7 41 13-25 7-54 7-80 0Z" />
          <path d="M145 331c-4 14-5 25-4 37m6 24c2 8 6 15 11 20" stroke="var(--paper)" strokeWidth="3" />
        </g>
        <g stroke="var(--accent)" strokeWidth="2" strokeLinecap="round">
          <path d="m83 533 5-21m4 13 18-2m-4 14 11 6" />
          <path d="M458 464c11-12 18-27 20-42m-9 27 23-7m-16-7-8-15" />
        </g>
      </svg>
      <div className="harvest-vine">
        <svg viewBox="0 0 270 300" fill="none" focusable="false">
          <g stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 35c38 7 95 13 120 49 15 21 14 46 24 65M135 78c11-20 28-34 50-36M86 48C73 34 75 18 90 19c15 0 16 18 3 20" />
            <path d="m132 76-12-23 17 4-5-33 23 13 14-28 12 30 26-14-6 29 28 3-21 18 15 17-35-1-7 22-19-18-18 6Z" fill="#91a889" />
            <path d="m137 81 34-42m-24 30 1-22m8 11 24-5m-23 5 3 25m7-35 16-7" strokeWidth="1.4" />
            <path d="m111 64-22-1 6 15-31 4 22 15-22 23 34-1-1 23 18-14 18 18 1-31 21-3-16-19 8-18Z" fill="#517c8b" />
            <path d="m124 83-29 30m15-17-18-1m18 1 4 22" stroke="var(--paper)" strokeWidth="1.4" />
            <path d="m153 124-21 35m26-22 23 24m-22-19 2 46" />
            <g stroke="var(--paper)" strokeWidth="2">
              {[
                [132, 159, '#73405d'], [172, 156, '#a4677d'], [209, 165, '#596f8e'],
                [119, 192, '#517c8b'], [161, 189, '#61263f'], [201, 195, '#8971a0'],
                [133, 225, '#a4677d'], [173, 221, '#73405d'],
                [150, 254, '#596f8e'], [176, 242, '#a4677d'], [165, 278, '#61263f'],
              ].map(([cx, cy, fill]) => <ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx={cy === 278 ? 15 : 21} ry={cy === 278 ? 15 : 22} fill={String(fill)} />)}
            </g>
            <path d="m121 150 8-3m33-1 8-2m30 10 8-2m-98 35 7-3m33-7 8-2m34 6 8-3m-76 33 7-3m33-6 8-2m-35 34 7-3m17-9 7-2m-13 33 6-2" stroke="var(--paper)" strokeWidth="1.5" />
          </g>
        </svg>
      </div>
    </div>
  </div>;
}
