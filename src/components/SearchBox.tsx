import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Search } from 'lucide-react';
import type { SCPItem } from '../services/scpApi';
import { getObjectClass, searchItems } from '../lib/scp';
import { href, navigate } from '../lib/router';

interface SearchBoxProps {
  items: SCPItem[];
  initialQuery?: string;
  autoFocusShortcut?: boolean;
  onDone?: () => void;
}

export default function SearchBox({ items, initialQuery = '', autoFocusShortcut = false, onDone }: SearchBoxProps) {
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQuery(initialQuery), [initialQuery]);

  const results = useMemo(() => searchItems(items, query, 7), [items, query]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    if (!autoFocusShortcut) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [autoFocusShortcut]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const finish = (to: string) => {
    navigate(to);
    setOpen(false);
    inputRef.current?.blur();
    onDone?.();
  };

  const submit = () => {
    const q = query.trim();
    if (!q) return;
    if (open && active > 0 && results[active - 1]) return finish(href.article(results[active - 1].id));
    // A bare designation ("173", "scp-173") jumps straight to the file.
    const digits = q.toLowerCase().replace(/^scp[-\s]?/, '');
    if (/^\d+$/.test(digits)) {
      const designation = `SCP-${digits.padStart(3, '0')}`;
      const exact = items.find((i) => i.scp.toUpperCase() === designation);
      if (exact) return finish(href.article(exact.id));
    }
    finish(href.search(q));
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const showDropdown = open && query.trim().length > 0;

  return (
    <div ref={boxRef} className="relative w-full">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="group relative"
      >
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Cerca per numero, titolo o tag…"
          aria-label="Cerca nell'archivio"
          aria-expanded={showDropdown}
          aria-controls="search-results"
          autoComplete="off"
          className="h-10 w-full border border-line bg-surface pl-10 pr-12 text-sm text-ink placeholder:text-muted transition-colors focus:border-line-strong focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {autoFocusShortcut && (
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 border border-line px-1.5 font-mono text-[10px] text-muted sm:block">
            /
          </kbd>
        )}
      </form>

      {showDropdown && (
        <div
          id="search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 border border-line-strong bg-surface shadow-card animate-rise"
        >
          {results.length === 0 ? (
            <p className="px-4 py-5 font-mono text-xs text-muted">
              {items.length === 0 ? 'Archivio in caricamento…' : 'Nessun dossier corrispondente.'}
            </p>
          ) : (
            <ul>
              {results.map((item, i) => {
                const cls = getObjectClass(item);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active === i + 1}
                      onMouseEnter={() => setActive(i + 1)}
                      onClick={() => finish(href.article(item.id))}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${active === i + 1 ? 'bg-surface-2' : ''}`}
                    >
                      <span className="size-2 shrink-0 rounded-full" style={{ background: cls.color }} />
                      <span className="w-24 shrink-0 font-mono text-xs font-bold">{item.scp}</span>
                      <span className="truncate font-serif text-[15px] text-ink-2">{item.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <button
            type="button"
            onClick={submit}
            className={`flex w-full items-center justify-between border-t border-line px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest text-ink-2 ${active === 0 ? 'bg-surface-2' : ''}`}
          >
            Tutti i risultati per “{query.trim()}”
            <CornerDownLeft size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
