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
  star:'<path d="M12 3l2.6 6 6.4.6-4.9 4.2 1.5 6.3L12 16.8 6.4 20.1l1.5-6.3L3 9.6l6.4-.6z"/>',
};
const uiIco=n=>'<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">'+(UI_ICO[n]||'')+'</svg>';
