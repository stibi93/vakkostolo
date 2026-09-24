import type { ReactNode } from 'react';
import type { AmbientMotion } from './useAmbientMotion';
import './home-atmosphere.css';

/** Shared, decorative vineyard palette; independent of all hidden wine data. */
export function HomeAtmosphere({ children, motion }: { children: ReactNode; motion: AmbientMotion }) {
  return <div className={`home-atmosphere${motion.running ? ' home-motion-running' : ''}`}>
    <div className="home-ambient" aria-hidden="true">
      <div className="ambient-leaves ambient-leaves-left"><LeafShadows /></div>
      <div className="ambient-leaves ambient-leaves-right"><LeafShadows /></div>
      <div className="ambient-gust ambient-gust-first"><WindLines /></div>
      <div className="ambient-gust ambient-gust-second"><WindLines /></div>
      <div className="ambient-rings"><GlassRings /></div>
      <div className="ambient-drift"><DriftingLeaves /></div>
    </div>
    {children}
  </div>;
}

export function HomeMotionToggle({ motion }: { motion: AmbientMotion }) {
  return <button className="home-motion-toggle" aria-pressed={motion.paused || motion.reduced} disabled={motion.reduced} onClick={motion.toggle}>
      <span aria-hidden="true">{motion.paused || motion.reduced ? '▷' : 'Ⅱ'}</span>
      {motion.reduced ? 'Mozgás kikapcsolva' : motion.paused ? 'Háttérmozgás indítása' : 'Háttérmozgás szüneteltetése'}
    </button>;
}

function LeafShadows() {
  return <svg viewBox="0 0 720 820" fill="currentColor" focusable="false">
    <path d="M-40 750C127 610 244 357 511-60" fill="none" stroke="currentColor" strokeWidth="5" />
    <path className="ambient-leaf-canopy" d="m155 535-91-13 22-37-101-50 86-20-29-104 82 48 24-101 44 81 90-47-31 93 87 36-96 35 17 65-74-20-30 75Zm135-203-53-63 38-14-37-93 74 28 41-87 21 77 87-35-39 73 79 42-78 15 7 75-58-31-35 67-14-55-54 15ZM59 678l-74-35 29-24-45-82 70 17 14-73 37 59 69-34-20 66 80 37-70 22 7 65-61-30-39 49Z" />
    <path className="ambient-leaf-tips" d="M511 92c68 9 114 57 119 111-52-11-105-52-119-111ZM379 401c92 5 152 45 180 111-95-4-152-44-180-111ZM202 588c92 22 137 78 142 142-73-31-123-76-142-142Z" />
  </svg>;
}

function WindLines() {
  return <svg viewBox="0 0 560 150" fill="none" focusable="false" strokeWidth="1.8" strokeLinecap="round">
    <path d="M8 77c91-51 167 25 253-9 45-18 63-57 36-59-30-3-37 44 7 49 83 10 135-50 245-21" stroke="#61263f" />
    <path d="M54 109c102-42 173 16 270-6 68-15 127-38 221-29" stroke="#517c8b" />
    <path d="M140 137c100-28 178 13 271-11" stroke="#69846b" />
  </svg>;
}

function GlassRings() {
  return <svg viewBox="0 0 500 500" fill="none" focusable="false">
    <circle cx="250" cy="250" r="184" stroke="#8a586e" strokeWidth="2" strokeDasharray="740 420" />
    <circle cx="250" cy="250" r="169" stroke="#517c8b" strokeWidth="18" strokeDasharray="210 852" transform="rotate(104 250 250)" />
    <circle cx="250" cy="250" r="152" stroke="#69846b" strokeWidth="2" strokeDasharray="470 486" transform="rotate(-44 250 250)" />
    <ellipse cx="250" cy="250" rx="206" ry="195" stroke="#ad7665" strokeWidth="1.5" transform="rotate(26 250 250)" />
  </svg>;
}

function DriftingLeaves() {
  return <svg viewBox="0 0 680 480" fill="none" focusable="false">
    <path d="M92 98c25-13 57-9 73 8-22 21-50 16-73-8Z" fill="#69846b" />
    <path d="M320 206c-8-25 4-48 29-62 10 28-2 50-29 62Z" fill="#8a586e" />
    <path d="M516 326c21-16 50-13 67 4-20 22-48 22-67-4Z" fill="#ad7665" />
    <path d="M198 364c18-4 34 5 41 24-23 1-35-6-41-24Z" fill="#517c8b" />
    <path d="M436 70c18-11 38-5 50 10-21 12-39 10-50-10Z" fill="#517c8b" />
    <path d="M102 105l61 2M324 198l21-45M521 333l56-1" stroke="#f4f1ed" strokeWidth="1.5" />
  </svg>;
}
