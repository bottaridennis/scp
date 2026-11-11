import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'article'; id: string }
  | { name: 'series'; key: string }
  | { name: 'class'; key: string }
  | { name: 'tag'; tag: string }
  | { name: 'search'; query: string }
  | { name: 'archive' }
  | { name: 'saved' }
  | { name: 'not-found' };

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\/+|\/+$/g, '');
  if (!path) return { name: 'home' };
  const [head, ...rest] = path.split('/');
  const arg = safeDecode(rest.join('/'));
  switch (head) {
    case 'scp':
      return arg ? { name: 'article', id: arg.toUpperCase() } : { name: 'archive' };
    case 'series':
      return arg ? { name: 'series', key: arg } : { name: 'archive' };
    case 'class':
      return arg ? { name: 'class', key: arg } : { name: 'archive' };
    case 'tag':
      return arg ? { name: 'tag', tag: arg } : { name: 'archive' };
    case 'search':
      return { name: 'search', query: arg };
    case 'archive':
      return { name: 'archive' };
    case 'saved':
      return { name: 'saved' };
    default:
      return { name: 'not-found' };
  }
}

export const href = {
  home: () => '#/',
  article: (id: string) => `#/scp/${encodeURIComponent(id)}`,
  series: (key: string) => `#/series/${encodeURIComponent(key)}`,
  objectClass: (key: string) => `#/class/${encodeURIComponent(key)}`,
  tag: (tag: string) => `#/tag/${encodeURIComponent(tag)}`,
  search: (q: string) => `#/search/${encodeURIComponent(q)}`,
  archive: () => '#/archive',
  saved: () => '#/saved',
};

export function navigate(to: string) {
  if (window.location.hash === to) return;
  window.location.hash = to;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
