import type { ReactNode } from 'react';
import { Archive, Bookmark, Home, Shuffle } from 'lucide-react';
import type { Route } from '../lib/router';
import { href } from '../lib/router';
import { NUMBERED_SERIES, OBJECT_CLASSES, SPECIAL_SERIES } from '../lib/scp';

interface SidebarProps {
  route: Route;
  counts: Record<string, number>;
  classCounts: Record<string, number>;
  savedCount: number;
  onRandom: () => void;
  onNavigate: () => void;
}

function NavLink({
  to,
  active,
  children,
  count,
  onClick,
}: {
  to: string;
  active: boolean;
  children: ReactNode;
  count?: number;
  onClick: () => void;
}) {
  return (
    <a
      href={to}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`group flex items-center gap-2.5 px-3 py-1.5 text-[13.5px] transition-colors ${
        active ? 'bg-ink text-bg' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
      }`}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className={`ml-auto font-mono text-[10px] ${active ? 'text-bg/70' : 'text-muted'}`}>{count}</span>
      )}
    </a>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="kicker mb-2 px-3">{title}</h2>
      <div className="space-y-px">{children}</div>
    </section>
  );
}

export default function Sidebar({ route, counts, classCounts, savedCount, onRandom, onNavigate }: SidebarProps) {
  const is = (name: Route['name'], key?: string) =>
    route.name === name &&
    (key === undefined ||
      (route.name === 'series' && route.key === key) ||
      (route.name === 'class' && route.key === key));

  return (
    <nav aria-label="Navigazione archivio" className="space-y-7 px-3 py-6">
      <Section title="Terminale">
        <NavLink to={href.home()} active={is('home')} onClick={onNavigate}>
          <Home size={15} /> Dashboard
        </NavLink>
        <NavLink to={href.archive()} active={is('archive')} onClick={onNavigate}>
          <Archive size={15} /> Archivio completo
        </NavLink>
        <NavLink to={href.saved()} active={is('saved')} count={savedCount} onClick={onNavigate}>
          <Bookmark size={15} /> Dossier salvati
        </NavLink>
        <button
          onClick={() => {
            onRandom();
            onNavigate();
          }}
          className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] text-accent hover:bg-accent-soft"
        >
          <Shuffle size={15} /> Dossier casuale
        </button>
      </Section>

      <Section title="Serie">
        {NUMBERED_SERIES.map((s) => (
          <NavLink key={s.key} to={href.series(s.key)} active={is('series', s.key)} count={counts[s.key]} onClick={onNavigate}>
            <span className="w-7 font-mono text-[11px] font-bold">{s.short}</span>
            <span className="font-mono text-[11.5px]">{s.range}</span>
          </NavLink>
        ))}
      </Section>

      <Section title="Collezioni">
        {SPECIAL_SERIES.map((s) => (
          <NavLink key={s.key} to={href.series(s.key)} active={is('series', s.key)} count={counts[s.key]} onClick={onNavigate}>
            {s.label}
          </NavLink>
        ))}
      </Section>

      <Section title="Classi d'oggetto">
        {OBJECT_CLASSES.filter((c) => c.key !== 'explained' && c.key !== 'decommissioned').map((c) => (
          <NavLink key={c.key} to={href.objectClass(c.key)} active={is('class', c.key)} count={classCounts[c.key]} onClick={onNavigate}>
            <span className="size-2 rounded-full" style={{ background: c.color }} />
            {c.label}
          </NavLink>
        ))}
      </Section>
    </nav>
  );
}
