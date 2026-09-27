export function CollapseBar({ closed, onToggle, label, summary, controls, compact = false }: {
  closed: boolean; onToggle: () => void; label: string; summary: string; controls: string; compact?: boolean;
}) {
  const button = <button type="button" className="button-secondary step-collapse" aria-expanded={!closed} aria-controls={controls} onClick={onToggle}>
    {closed ? 'Kinyitás' : 'Becsukás'}<span className="sr-only"> · {label}</span>
  </button>;
  if (compact) return button;
  return <div className="step-collapse-bar">
    {closed && <p className="step-collapse-summary">{summary}</p>}
    {button}
  </div>;
}
