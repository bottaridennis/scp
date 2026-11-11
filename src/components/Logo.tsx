export default function Logo({ className = '' }: { className?: string }) {
  // Emblem: outer ring, inner ring and three inward-pointing arrows.
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" fill="none" stroke="currentColor">
      <circle cx="24" cy="24" r="21" strokeWidth="3.5" />
      <circle cx="24" cy="24" r="7.5" strokeWidth="3" />
      {[0, 120, 240].map((angle) => (
        <g key={angle} transform={`rotate(${angle} 24 24)`}>
          <path d="M24 4.5 V13" strokeWidth="3.5" />
          <path d="M19.5 10.5 L24 15.5 L28.5 10.5" strokeWidth="3" strokeLinejoin="miter" />
        </g>
      ))}
    </svg>
  );
}
