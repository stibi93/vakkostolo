import type { ReactNode } from 'react';
import type { AmbientMotion } from './useAmbientMotion';
import './home-atmosphere.css';

/** Only mounted on the homepage; two lightweight leaf-shadow layers behind the content. */
export function HomeAtmosphere({ children, motion }: { children: ReactNode; motion: AmbientMotion }) {
  return <div className={`home-atmosphere${motion.running ? ' home-motion-running' : ''}`}>
    <div className="home-ambient" aria-hidden="true">
      <div className="ambient-leaves ambient-leaves-left"><LeafShadows /></div>
      <div className="ambient-leaves ambient-leaves-right"><LeafShadows /></div>
      <div className="ambient-gust ambient-gust-first"><WindLines /></div>
      <div className="ambient-gust ambient-gust-second"><WindLines /></div>
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
    <path d="m155 535-91-13 22-37-101-50 86-20-29-104 82 48 24-101 44 81 90-47-31 93 87 36-96 35 17 65-74-20-30 75Zm135-203-53-63 38-14-37-93 74 28 41-87 21 77 87-35-39 73 79 42-78 15 7 75-58-31-35 67-14-55-54 15ZM59 678l-74-35 29-24-45-82 70 17 14-73 37 59 69-34-20 66 80 37-70 22 7 65-61-30-39 49Z" />
    <path d="M511 92c68 9 114 57 119 111-52-11-105-52-119-111ZM379 401c92 5 152 45 180 111-95-4-152-44-180-111ZM202 588c92 22 137 78 142 142-73-31-123-76-142-142Z" />
  </svg>;
}

function WindLines() {
  return <svg viewBox="0 0 560 150" fill="none" focusable="false">
    <path d="M8 77c91-51 167 25 253-9 45-18 63-57 36-59-30-3-37 44 7 49 83 10 135-50 245-21M54 109c102-42 173 16 270-6 68-15 127-38 221-29M140 137c100-28 178 13 271-11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>;
}
