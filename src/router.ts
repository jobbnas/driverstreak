import { signal } from '@preact/signals';

export interface Route {
  path: string;
  parts: string[];
  query: URLSearchParams;
}

function parse(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [pathPart, queryPart] = raw.split('?') as [string, string | undefined];
  const path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  return { path, parts: path.split('/').filter(Boolean), query: new URLSearchParams(queryPart ?? '') };
}

export const route = signal<Route>(parse(typeof location !== 'undefined' ? location.hash : ''));

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    route.value = parse(location.hash);
    window.scrollTo(0, 0);
  });
}

export function navigate(path: string, replace = false): void {
  const target = `#${path.startsWith('/') ? path : `/${path}`}`;
  if (replace) location.replace(target);
  else location.hash = target;
}

export function back(fallback = '/'): void {
  if (history.length > 1) history.back();
  else navigate(fallback, true);
}
