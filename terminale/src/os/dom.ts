/** Tiny DOM helpers. */
type Attrs = Record<string, string | number | boolean | undefined | null | EventListener>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'html') el.innerHTML = String(v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c);
  }
  return el;
}

export function icon(svg: string, cls = 'ico'): HTMLElement {
  return h('span', { class: cls, 'aria-hidden': 'true', html: svg });
}

export const isMobile = () => window.matchMedia('(max-width: 760px)').matches;
export const isTouch = () => window.matchMedia('(pointer: coarse)').matches;
