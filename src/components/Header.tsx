import { Bookmark, Menu, Moon, Sun, X } from 'lucide-react';
import type { SCPItem } from '../services/scpApi';
import { href } from '../lib/router';
import { useFavorites, useTheme } from '../lib/storage';
import Logo from './Logo';
import SearchBox from './SearchBox';

interface HeaderProps {
  items: SCPItem[];
  searchQuery: string;
  isMenuOpen: boolean;
  onMenuToggle: () => void;
}

export default function Header({ items, searchQuery, isMenuOpen, onMenuToggle }: HeaderProps) {
  const { theme, toggle } = useTheme();
  const { favorites } = useFavorites();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md no-print">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button
          onClick={onMenuToggle}
          aria-label={isMenuOpen ? 'Chiudi menu' : 'Apri menu'}
          aria-expanded={isMenuOpen}
          className="-ml-1 grid size-10 place-items-center text-ink hover:text-accent lg:hidden"
        >
          {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <a href={href.home()} className="group flex shrink-0 items-center gap-3" aria-label="Home">
          <Logo className="size-9 text-ink transition-colors group-hover:text-accent" />
          <span className="hidden leading-none sm:block">
            <span className="block font-display text-[17px] font-black uppercase tracking-tight">SCP Foundation</span>
            <span className="mt-1 block font-mono text-[9.5px] uppercase tracking-[0.28em] text-muted">
              Archivio · Site-19
            </span>
          </span>
        </a>

        <div className="mx-auto hidden w-full max-w-xl px-4 md:block">
          <SearchBox items={items} initialQuery={searchQuery} autoFocusShortcut />
        </div>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <a
            href={href.saved()}
            className="relative grid size-10 place-items-center text-ink-2 hover:text-ink"
            aria-label={`Dossier salvati (${favorites.length})`}
          >
            <Bookmark size={19} />
            {favorites.length > 0 && (
              <span className="absolute right-1 top-1 grid min-w-4 place-items-center bg-accent px-1 font-mono text-[9px] font-bold leading-4 text-accent-ink">
                {favorites.length}
              </span>
            )}
          </a>
          <button
            onClick={toggle}
            className="grid size-10 place-items-center text-ink-2 hover:text-ink"
            aria-label={theme === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
          >
            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>
        </div>
      </div>

      <div className="flex h-[60px] items-center border-t border-line px-4 md:hidden">
        <SearchBox items={items} initialQuery={searchQuery} />
      </div>
    </header>
  );
}
