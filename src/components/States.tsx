import type { ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

export function Loader({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-24 text-center" role="status">
      <div className="relative h-14 w-44 overflow-hidden border border-line bg-surface">
        <div className="absolute inset-x-0 h-1/2 bg-gradient-to-b from-transparent via-accent/25 to-transparent animate-scan" />
        <div className="absolute inset-0 grid place-items-center font-mono text-[11px] tracking-[0.3em] text-ink-2">
          ▮▮▮▮▮▯▯▯
        </div>
      </div>
      <p className="kicker">{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mx-auto my-16 max-w-lg border border-accent/40 bg-accent-soft p-8 text-center">
      <AlertTriangle className="mx-auto mb-4 text-accent" size={28} />
      <p className="font-display text-xl font-extrabold uppercase tracking-tight">Errore di sistema</p>
      <p className="mt-2 font-mono text-sm text-ink-2">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-6 inline-flex items-center gap-2 border border-line-strong px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest hover:bg-ink hover:text-bg transition-colors"
        >
          <RotateCw size={14} /> Riprova
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border border-dashed border-line px-6 py-20 text-center">
      <p className="font-display text-lg font-extrabold uppercase tracking-tight">{title}</p>
      {children && <div className="mt-2 text-sm text-ink-2">{children}</div>}
    </div>
  );
}
