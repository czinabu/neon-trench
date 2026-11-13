"use strict";
/* The menu icon set: small line icons drawn as inline SVG so they match the UI type and colour (they use
   currentColor) instead of whatever font happens to have a Unicode symbol. uiIco('check') returns the markup
   for innerHTML; css/theme.css sizes them (.ico) to the text around them. The parts currency mark is CSS
   only (<i class="icp"></i>), so it can go in plain HTML too. */
const UI_ICO={
  ops:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.6"/><path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5"/>',
  map:'<circle cx="5" cy="18" r="2.2"/><circle cx="12" cy="7" r="2.2"/><circle cx="19" cy="15" r="2.2"/><path d="M6.3 16.1l4.4-7.2M13.6 8.7l4 4.5"/>',
  hangar:'<path d="M12 2.5l1.8 6.8 7.7 4.2v2.2l-7.6-1.4-.9 4.5 2.3 1.2v1.5h-6.6v-1.5l2.3-1.2-.9-4.5-7.6 1.4v-2.2l7.7-4.2z"/>',
  fleet:'<path d="M4 9.5l8-5 8 5M4 15l8-5 8 5M4 20.5l8-5 8 5"/>',
  log:'<path d="M5 5h14M5 10h14M5 15h10M5 20h6"/>',
  check:'<path d="M4.5 12.5l4.8 4.8L19.5 7"/>',
  cross:'<path d="M6 6l12 12M18 6L6 18"/>',
  next:'<path d="M8 4.5l7.5 7.5L8 19.5"/>',
  side:'<path d="M12 3.5l8.5 8.5-8.5 8.5L3.5 12z"/>',
  school:'<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6"/>',
  sim:'<rect x="3" y="4" width="18" height="12"/><path d="M8 20h8M12 16v4M7 12l3-3 3 2 4-4"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.5-6.5 8-6.5s7 2 8 6.5"/>',
  save:'<path d="M4 4h13l3 3v13H4z"/><path d="M8 4v5h8V4M8 20v-6h8v6"/>',
  gear:'<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22M4.9 4.9l2.5 2.5M16.6 16.6l2.5 2.5M4.9 19.1l2.5-2.5M16.6 7.4l2.5-2.5"/>',
  wrench:'<path d="M14.5 3.5a5 5 0 0 0-4.6 6.9L3.5 16.8l3.7 3.7 6.4-6.4a5 5 0 0 0 6.9-4.6l-3 3-3.4-.6-.6-3.4z"/>',
  room:'<path d="M3 21V8l9-5 9 5v13M9 21v-7h6v7"/>',
  star:'<path d="M12 3l2.6 6 6.4.6-4.9 4.2 1.5 6.3L12 16.8 6.4 20.1l1.5-6.3L3 9.6l6.4-.6z"/>',
};
const uiIco=n=>'<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">'+(UI_ICO[n]||'')+'</svg>';
