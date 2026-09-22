// Kartstil (bakgrunnskart, terreng, grenser, søyler, navn) og uttrykk for søylene.
import { THEME, PAL, DENS_BR, CHG_BR, PST_BR, BASE, ZDO, ZGK } from './config.js';

const EMPTY = { type: 'FeatureCollection', features: [] };
const LABEL = ['coalesce', ['get', 'name:nb'], ['get', 'name:no'], ['get', 'name']];
const vis = on => (on ? 'visible' : 'none');

export function buildStyle(S) {
  const T = THEME[S.tema];
  const geo = () => ({ type: 'geojson', data: EMPTY });
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
      dem: { type: 'raster-dem', url: 'https://tiles.mapterhorn.com/tilejson.json' },
      hs: { type: 'raster-dem', url: 'https://tiles.mapterhorn.com/tilejson.json' },
      cols: geo(), gkfc: geo(), dofc: geo(), gkline: geo(), doline: geo(), kommline: geo(), fylkeline: geo()
    },
    terrain: { source: 'dem', exaggeration: 1.35 },
    sky: T.sky,
    light: T.light,
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': T.land } },
      { id: 'wood', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'wood'], paint: { 'fill-color': T.wood, 'fill-opacity': .7 } },
      { id: 'ice', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'ice'], paint: { 'fill-color': T.ice, 'fill-opacity': .9 } },
      { id: 'hill', type: 'hillshade', source: 'hs', paint: { 'hillshade-shadow-color': T.shadow, 'hillshade-highlight-color': T.hi, 'hillshade-exaggeration': T.hsEx } },
      { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': T.water } },
      { id: 'river', type: 'line', source: 'omt', 'source-layer': 'waterway', minzoom: 8, paint: { 'line-color': T.water, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, .5, 14, 2] } },
      {
        id: 'road', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 6,
        filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], true, ['secondary'], ['>=', ['zoom'], 9], ['tertiary', 'minor'], ['>=', ['zoom'], 12], false],
        paint: { 'line-color': T.road, 'line-opacity': T.roadOp, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, .6, 12, 2, 15, 4] }
      },
      // Usynlige flater for å kunne peke på områder
      { id: 'gk-fill', type: 'fill', source: 'gkfc', minzoom: ZGK, layout: { visibility: vis(S.gk) }, paint: { 'fill-color': '#000', 'fill-opacity': 0 } },
      { id: 'do-fill', type: 'fill', source: 'dofc', minzoom: ZDO, layout: { visibility: vis(S.do) }, paint: { 'fill-color': '#000', 'fill-opacity': 0 } },
      {
        id: 'gk-line', type: 'line', source: 'gkline', minzoom: ZGK, layout: { visibility: vis(S.gk), 'line-join': 'round' },
        paint: { 'line-color': T.gkL, 'line-opacity': ['interpolate', ['linear'], ['zoom'], ZGK, 0, ZGK + .6, .5], 'line-width': ['interpolate', ['linear'], ['zoom'], 9, .5, 14, 1.3], 'line-dasharray': [2, 1.5] }
      },
      {
        id: 'do-line', type: 'line', source: 'doline', minzoom: ZDO, layout: { visibility: vis(S.do), 'line-join': 'round' },
        paint: { 'line-color': T.doL, 'line-opacity': ['interpolate', ['linear'], ['zoom'], ZDO, 0, ZDO + .6, .6], 'line-width': ['interpolate', ['linear'], ['zoom'], 7, .7, 14, 2] }
      },
      { id: 'komm-line', type: 'line', source: 'kommline', layout: { visibility: vis(S.komm), 'line-join': 'round' }, paint: { 'line-color': T.komm, 'line-opacity': .55, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, .5, 10, 1.2] } },
      { id: 'fylke-line', type: 'line', source: 'fylkeline', layout: { visibility: vis(S.fylke), 'line-join': 'round' }, paint: { 'line-color': T.fyl, 'line-opacity': .6, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, .8, 10, 2.2] } },
      { id: 'border', type: 'line', source: 'omt', 'source-layer': 'boundary', filter: ['==', ['get', 'admin_level'], 2], paint: { 'line-color': T.border, 'line-width': 1.2, 'line-dasharray': [3, 2] } },
      { id: 'gk-hl', type: 'line', source: 'gkfc', layout: { visibility: vis(S.gk) }, filter: ['in', ['get', 'gk'], ['literal', []]], paint: { 'line-color': T.hl, 'line-width': 3 } },
      { id: 'do-hl', type: 'line', source: 'dofc', layout: { visibility: vis(S.do) }, filter: ['in', ['get', 'do'], ['literal', []]], paint: { 'line-color': T.hl, 'line-width': 3.5 } },
      { id: 'cols', type: 'fill-extrusion', source: 'cols', paint: { 'fill-extrusion-color': '#7cbca9', 'fill-extrusion-height': 0, 'fill-extrusion-base': 0, 'fill-extrusion-opacity': PAL[S.tema].op, 'fill-extrusion-vertical-gradient': true } },
      label('lab-city', 'city', 4, 'Noto Sans Bold', ['interpolate', ['linear'], ['zoom'], 4, 11, 10, 16], 1.4, S, T),
      label('lab-town', 'town', 7, 'Noto Sans Regular', ['interpolate', ['linear'], ['zoom'], 7, 11, 12, 14], 1.2, S, T),
      label('lab-vil', ['village', 'suburb'], 10.5, 'Noto Sans Regular', 12, 1.1, S, T)
    ]
  };
}

function label(id, cls, minzoom, font, size, halo, S, T) {
  const filter = Array.isArray(cls) ? ['match', ['get', 'class'], cls, true, false] : ['==', ['get', 'class'], cls];
  return {
    id, type: 'symbol', source: 'omt', 'source-layer': 'place', filter, minzoom,
    layout: { 'text-field': LABEL, 'text-font': [font], 'text-size': size, visibility: vis(S.navn) },
    paint: { 'text-color': T.lab, 'text-halo-color': T.halo, 'text-halo-width': halo }
  };
}

export const LABEL_LAYERS = ['lab-city', 'lab-town', 'lab-vil'];

function step(prop, br, cols) {
  const e = ['step', ['get', prop], cols[0]];
  br.forEach((b, i) => e.push(b, cols[i + 1]));
  return e;
}

export function colorExpr(S) {
  const P = PAL[S.tema];
  const cat = rest => ['case', ['==', ['get', 'cat'], 1], P.nyC, ['==', ['get', 'cat'], 2], P.tomC, rest];
  let base;
  if (S.farge === 'tetthet') base = step(S.aar === 'til' ? 'dt' : 'df', DENS_BR, P.dens);
  else if (S.farge === 'antall') base = cat(step('cd', CHG_BR, P.chg));
  else base = cat(['case', ['<', ['get', 'rp'], -9000], P.few, step('rp', PST_BR, P.pst)]);
  return ['case',
    ['boolean', ['feature-state', 'hover'], false], P.hov,
    ['boolean', ['feature-state', 'sel'], false], P.hov,
    base];
}

export function heightExpr(S, level) {
  const K = BASE[level] * S.k;
  return ['max', ['*', ['sqrt', ['get', S.aar === 'til' ? 'dt' : 'df']], K], K * 1.1];
}

// I tetthetsvisning skjules ruter uten bosatte i det valgte året.
export function filterExpr(S) {
  return S.farge === 'tetthet' ? ['>', ['get', S.aar === 'til' ? 'pt' : 'pf'], 0] : null;
}

export function applyTheme(map, S) {
  const t = THEME[S.tema], P = (id, k, v) => map.setPaintProperty(id, k, v);
  document.documentElement.dataset.tema = S.tema;
  P('bg', 'background-color', t.land);
  P('wood', 'fill-color', t.wood); P('ice', 'fill-color', t.ice);
  P('water', 'fill-color', t.water); P('river', 'line-color', t.water);
  P('road', 'line-color', t.road); P('road', 'line-opacity', t.roadOp);
  P('hill', 'hillshade-shadow-color', t.shadow); P('hill', 'hillshade-highlight-color', t.hi);
  P('komm-line', 'line-color', t.komm); P('fylke-line', 'line-color', t.fyl); P('border', 'line-color', t.border);
  P('gk-line', 'line-color', t.gkL); P('do-line', 'line-color', t.doL);
  P('gk-hl', 'line-color', t.hl); P('do-hl', 'line-color', t.hl);
  for (const id of LABEL_LAYERS) { P(id, 'text-color', t.lab); P(id, 'text-halo-color', t.halo); }
  try { map.setSky(t.sky); } catch (e) { /* eldre MapLibre */ }
  try { map.setLight(t.light); } catch (e) { /* eldre MapLibre */ }
}
