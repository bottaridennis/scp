/** 16×16 pixel-style icons (currentColor where it makes sense). */
const svg = (body: string, vb = '0 0 16 16') =>
  `<svg viewBox="${vb}" width="16" height="16" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

export const ICONS = {
  logo: svg('<circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8" cy="8" r="2.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.5v3.2M2.4 11.2l2.8-1.6M13.6 11.2l-2.8-1.6" stroke="currentColor" stroke-width="1.6"/>'),
  terminal: svg('<rect x="1" y="2" width="14" height="12" fill="#101410" stroke="#555"/><rect x="1" y="2" width="14" height="2" fill="#3a4a6b"/><path d="M3 7l2 1.5L3 10" fill="none" stroke="#3dff7a" stroke-width="1.2"/><rect x="6.5" y="10" width="4" height="1" fill="#3dff7a"/>'),
  folder: svg('<path d="M1 4h5l1.5 1.5H15V13H1z" fill="#d9b44a" stroke="#7a5d14"/><rect x="1" y="6" width="14" height="7" fill="#e8c862" stroke="#7a5d14"/>'),
  folderLocked: svg('<path d="M1 4h5l1.5 1.5H15V13H1z" fill="#9a9a90" stroke="#55554f"/><rect x="1" y="6" width="14" height="7" fill="#b4b4aa" stroke="#55554f"/><rect x="9" y="9" width="5" height="4" fill="#7a1f1f"/><path d="M10 9V8a1.5 1.5 0 013 0v1" fill="none" stroke="#7a1f1f"/>'),
  doc: svg('<path d="M3 1h7l3 3v11H3z" fill="#fff" stroke="#555"/><path d="M10 1v3h3" fill="none" stroke="#555"/><path d="M5 7h6M5 9h6M5 11h4" stroke="#8a8a8a"/>'),
  docHtml: svg('<path d="M3 1h7l3 3v11H3z" fill="#f3efe3" stroke="#555"/><path d="M10 1v3h3" fill="none" stroke="#555"/><rect x="4.5" y="6" width="7" height="2" fill="#7a1f1f"/><path d="M5 10h6M5 12h5" stroke="#8a8a8a"/>'),
  docLocked: svg('<path d="M3 1h7l3 3v11H3z" fill="#ddd" stroke="#666"/><rect x="5" y="8" width="6" height="5" fill="#7a1f1f"/><path d="M6.5 8V6.8a1.5 1.5 0 013 0V8" fill="none" stroke="#7a1f1f" stroke-width="1.2"/>'),
  docEncrypted: svg('<path d="M3 1h7l3 3v11H3z" fill="#e9e4cf" stroke="#666"/><path d="M5 6h2M8 6h3M5 8h4M10 8h1M5 10h1M7 10h4M5 12h3" stroke="#6b6b3a"/>'),
  image: svg('<rect x="1" y="2" width="14" height="12" fill="#fff" stroke="#555"/><path d="M2 12l4-5 3 3.5 2-2 3 3.5z" fill="#5d7a5a"/><circle cx="11" cy="5.5" r="1.4" fill="#d9b44a"/>'),
  mail: svg('<rect x="1" y="3" width="14" height="10" fill="#fff" stroke="#555"/><path d="M1 3l7 5.5L15 3" fill="none" stroke="#555"/>'),
  settings: svg('<circle cx="8" cy="8" r="2.4" fill="none" stroke="#333" stroke-width="1.4"/><path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15M3 3l1.8 1.8M11.2 11.2L13 13M13 3l-1.8 1.8M4.8 11.2L3 13" stroke="#333" stroke-width="1.6"/>'),
  archive: svg('<rect x="2" y="1" width="12" height="14" fill="#9aa3a8" stroke="#444"/><rect x="3.5" y="2.5" width="9" height="5" fill="#b7bfc4" stroke="#444"/><rect x="3.5" y="8.5" width="9" height="5" fill="#b7bfc4" stroke="#444"/><rect x="6.5" y="4" width="3" height="1" fill="#333"/><rect x="6.5" y="10" width="3" height="1" fill="#333"/>'),
  user: svg('<circle cx="8" cy="5" r="3" fill="#c9c3b5" stroke="#555"/><path d="M2 15c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5z" fill="#3a4a6b" stroke="#222"/>'),
  guest: svg('<circle cx="8" cy="5" r="3" fill="#ddd" stroke="#777"/><path d="M2 15c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5z" fill="#999" stroke="#666"/>'),
  message: svg('<path d="M1 2h14v9H6l-3 3v-3H1z" fill="#2a0c0c" stroke="#c22"/><path d="M4 5h8M4 7.5h5" stroke="#ff5c4d"/>'),
  warning: svg('<path d="M8 1l7 13H1z" fill="#e8c34a" stroke="#6b5310"/><rect x="7.2" y="5" width="1.6" height="5" fill="#222"/><rect x="7.2" y="11" width="1.6" height="1.6" fill="#222"/>'),
  power: svg('<path d="M5 3.5a5.5 5.5 0 106 0" fill="none" stroke="#7a1f1f" stroke-width="1.8"/><path d="M8 1v7" stroke="#7a1f1f" stroke-width="1.8"/>'),
  swap: svg('<path d="M2 5h10l-2.5-2.5M14 11H4l2.5 2.5" fill="none" stroke="#333" stroke-width="1.6"/>'),
};

export type IconName = keyof typeof ICONS;
