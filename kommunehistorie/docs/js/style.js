// Kartstil og uttrykk for grenselinjene.
import { THEME, LINE_WIDTH, CHANGE_MIN, KOMMUNE, FYLKE, RIKE } from './config.js';

const EMPTY = { type: 'FeatureCollection', features: [] };
const vis = on => (on ? 'visible' : 'none');

export function buildStyle(S) {
  const T = THEME[S.tema];
  const line = (id, extra = {}) => ({
    id, type: 'line', source: 'lines', filter: ['==', ['get', 'y0'], -1],
    layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': T.line[KOMMUNE], 'line-width': 1, ...extra }
  });
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
      dem: { type: 'raster-dem', url: 'https://tiles.mapterhorn.com/tilejson.json' },
      hs: { type: 'raster-dem', url: 'https://tiles.mapterhorn.com/tilejson.json' },
      atoms: { type: 'geojson', data: EMPTY }, lines: { type: 'geojson', data: EMPTY }, labels: { type: 'geojson', data: EMPTY }
    },
    terrain: { source: 'dem', exaggeration: 1.25 },
    sky: T.sky, light: T.light,
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': T.land } },
      { id: 'wood', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'wood'], paint: { 'fill-color': T.wood, 'fill-opacity': .7 } },
      { id: 'ice', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'ice'], paint: { 'fill-color': T.ice, 'fill-opacity': .9 } },
      { id: 'hill', type: 'hillshade', source: 'hs', paint: { 'hillshade-shadow-color': T.shadow, 'hillshade-highlight-color': T.hi, 'hillshade-exaggeration': T.hsEx } },
      { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': T.water } },
      { id: 'k-new', type: 'fill', source: 'atoms', filter: ['in', ['get', 's0'], ['literal', []]], layout: { visibility: vis(S.ny) }, paint: { 'fill-color': T.tint, 'fill-opacity': T.tintOp } },
      { id: 'k-hover', type: 'fill', source: 'atoms', filter: ['==', ['get', 's0'], ''], paint: { 'fill-color': T.hover, 'fill-opacity': .12 } },
      { id: 'k-sel', type: 'fill', source: 'atoms', filter: ['==', ['get', 's0'], ''], paint: { 'fill-color': T.sel, 'fill-opacity': .26 } },
      // Fylkesfilter: dekker alt utenfor valgt fylke
      { id: 'mask', type: 'fill', source: 'atoms', filter: ['==', ['get', 'f0'], '__'], paint: { 'fill-color': T.mask, 'fill-opacity': .88 } },
      { id: 'k-pick', type: 'fill', source: 'atoms', paint: { 'fill-color': '#000', 'fill-opacity': 0 } },
      line('b-gone', { 'line-color': T.borte, 'line-dasharray': [2, 1.4] }),
      line('b-halo', { 'line-color': T.halo, 'line-blur': .5 }),
      line('b-cur'),
      {
        id: 'labels', type: 'symbol', source: 'labels', layout: {
          'text-field': ['get', 'n'], 'text-font': ['Noto Sans Regular'], visibility: vis(S.navn),
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, 9.5, 7, 12, 10, 14], 'text-max-width': 8, 'text-padding': 3
        }, paint: { 'text-color': T.lab, 'text-halo-color': T.halo, 'text-halo-width': 1.3 }
      }
    ]
  };
}

const types = S => [S.kommune && KOMMUNE, S.fylkeL && FYLKE, S.rike && RIKE].filter(Boolean);
const typeIn = S => ['in', ['get', 't'], ['literal', types(S)]];

// Linjebredde etter type og zoom. Nye og forsvunne grenser får en minstebredde.
// MapLibre tillater bare ett zoom-uttrykk, så valget ligger inne i hvert zoomtrinn.
function interp(stops, z) {
  if (z <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) if (z <= stops[i][0]) {
    const [z0, v0] = stops[i - 1], [z1, v1] = stops[i];
    return v0 + (v1 - v0) * (z - z0) / (z1 - z0);
  }
  return stops[stops.length - 1][1];
}
function width(S, emphasis, extra = 0) {
  const zooms = [...new Set([...Object.values(LINE_WIDTH).flat(), ...CHANGE_MIN].map(s => s[0]))].sort((a, b) => a - b);
  return ['interpolate', ['linear'], ['zoom'], ...zooms.flatMap(z => {
    const byType = ['match', ['get', 't'], FYLKE, interp(LINE_WIDTH[FYLKE], z), RIKE, interp(LINE_WIDTH[RIKE], z), interp(LINE_WIDTH[KOMMUNE], z)];
    const w = ['case', emphasis, ['max', byType, interp(CHANGE_MIN, z)], byType];
    return [z, ['+', extra, ['*', S.k, w]]];
  })];
}

export function applyYear(map, S, Y, minYear, prevYear = Y - 1) {
  const T = THEME[S.tema];
  const exists = ['all', ['<=', ['get', 'y0'], Y], ['>=', ['get', 'y1'], Y]];
  // Ny grense: fantes ikke i forrige tilstand (ikke bare skiftet type, som ved fylkesreformer)
  const isNew = ['all', S.ny && Y > minYear, ['==', ['get', 'y0'], Y], ['==', ['get', 'nw'], 1]];
  map.setFilter('b-cur', ['all', exists, typeIn(S)]);
  map.setFilter('b-halo', ['all', exists, typeIn(S)]);
  map.setFilter('b-gone', ['all', S.borte && prevYear !== null, ['==', ['get', 'y1'], prevYear ?? -1], ['==', ['get', 'gn'], 1], ['!=', ['get', 't'], RIKE]]);
  map.setPaintProperty('b-cur', 'line-color', ['case', isNew, T.ny, ['match', ['get', 't'], FYLKE, T.line[FYLKE], RIKE, T.line[RIKE], T.line[KOMMUNE]]]);
  map.setPaintProperty('b-cur', 'line-width', width(S, isNew));
  map.setPaintProperty('b-halo', 'line-width', width(S, isNew, 2));
  map.setPaintProperty('b-gone', 'line-width', width(S, true));
}

export function applyTheme(map, S) {
  const t = THEME[S.tema], P = (id, k, v) => map.setPaintProperty(id, k, v);
  document.documentElement.dataset.tema = S.tema;
  P('bg', 'background-color', t.land); P('wood', 'fill-color', t.wood); P('ice', 'fill-color', t.ice);
  P('water', 'fill-color', t.water);
  P('hill', 'hillshade-shadow-color', t.shadow); P('hill', 'hillshade-highlight-color', t.hi);
  P('k-new', 'fill-color', t.tint); P('k-new', 'fill-opacity', t.tintOp);
  P('k-hover', 'fill-color', t.hover); P('k-sel', 'fill-color', t.sel); P('mask', 'fill-color', t.mask);
  P('b-gone', 'line-color', t.borte); P('b-halo', 'line-color', t.halo);
  P('labels', 'text-color', t.lab); P('labels', 'text-halo-color', t.halo);
  try { map.setSky(t.sky); } catch (e) { }
  try { map.setLight(t.light); } catch (e) { }
}
