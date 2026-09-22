// Kartstil og uttrykk for murene.
import { THEME, HEIGHT_STOPS, TYPE_FACTOR, GHOST, KOMMUNE, FYLKE, RIKE } from './config.js';

const EMPTY = { type: 'FeatureCollection', features: [] };
const vis = on => (on ? 'visible' : 'none');

export function buildStyle(S) {
  const T = THEME[S.tema];
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
      dem: { type: 'raster-dem', url: 'https://tiles.mapterhorn.com/tilejson.json' },
      hs: { type: 'raster-dem', url: 'https://tiles.mapterhorn.com/tilejson.json' },
      atoms: { type: 'geojson', data: EMPTY }, walls: { type: 'geojson', data: EMPTY }, labels: { type: 'geojson', data: EMPTY }
    },
    terrain: { source: 'dem', exaggeration: 1.25 },
    sky: T.sky, light: T.light,
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': T.land } },
      { id: 'wood', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'wood'], paint: { 'fill-color': T.wood, 'fill-opacity': .7 } },
      { id: 'ice', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'ice'], paint: { 'fill-color': T.ice, 'fill-opacity': .9 } },
      { id: 'hill', type: 'hillshade', source: 'hs', paint: { 'hillshade-shadow-color': T.shadow, 'hillshade-highlight-color': T.hi, 'hillshade-exaggeration': T.hsEx } },
      { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': T.water } },
      { id: 'k-new', type: 'fill', source: 'atoms', filter: ['in', ['get', 's0'], ['literal', []]], layout: { visibility: vis(S.ny) }, paint: { 'fill-color': T.tint, 'fill-opacity': .22 } },
      { id: 'k-hover', type: 'fill', source: 'atoms', filter: ['==', ['get', 's0'], ''], paint: { 'fill-color': T.hover, 'fill-opacity': .12 } },
      { id: 'k-sel', type: 'fill', source: 'atoms', filter: ['==', ['get', 's0'], ''], paint: { 'fill-color': T.sel, 'fill-opacity': .26 } },
      { id: 'k-pick', type: 'fill', source: 'atoms', paint: { 'fill-color': '#000', 'fill-opacity': 0 } },
      { id: 'walls', type: 'fill-extrusion', source: 'walls', paint: { 'fill-extrusion-color': T.wall[KOMMUNE], 'fill-extrusion-height': 0, 'fill-extrusion-base': 0, 'fill-extrusion-opacity': T.op, 'fill-extrusion-vertical-gradient': true } },
      {
        id: 'labels', type: 'symbol', source: 'labels', layout: {
          'text-field': ['get', 'n'], 'text-font': ['Noto Sans Regular'], visibility: vis(S.navn),
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, 9.5, 7, 12, 10, 14], 'text-max-width': 8, 'text-padding': 3
        }, paint: { 'text-color': T.lab, 'text-halo-color': T.halo, 'text-halo-width': 1.3 }
      }
    ]
  };
}

// Høyden vokser fram mellom år y0−1 og y0, og synker mellom y1 og y1+1.
// T er et flytende år under animasjon; Y er året som er valgt.
export function wallHeight(T, Y, S, animating) {
  const grow = ['*',
    ['min', 1, ['max', 0, ['-', T, ['-', ['get', 'y0'], 1]]]],
    ['min', 1, ['max', 0, ['-', ['+', ['get', 'y1'], 1], T]]]];
  const ghost = S.borte && !animating ? ['case', ['==', ['get', 'y1'], Y - 1], GHOST, 0] : 0;
  const f = ['*', ['max', grow, ghost], ['match', ['get', 't'], FYLKE, TYPE_FACTOR[FYLKE], RIKE, TYPE_FACTOR[RIKE], TYPE_FACTOR[KOMMUNE]]];
  return ['interpolate', ['exponential', 1.6], ['zoom'], ...HEIGHT_STOPS.flatMap(([z, h]) => [z, ['*', h * S.k, f]])];
}

export function wallColor(Y, S, minYear, animating) {
  const T = THEME[S.tema];
  const base = ['match', ['get', 't'], FYLKE, T.wall[FYLKE], RIKE, T.wall[RIKE], T.wall[KOMMUNE]];
  if (animating) return base;
  return ['case',
    ['all', S.ny && Y > minYear, ['==', ['get', 'y0'], Y]], T.ny,
    ['==', ['get', 'y1'], Y - 1], T.borte,
    base];
}

export function wallFilter(S) {
  const types = [S.kommune && KOMMUNE, S.fylke && FYLKE, S.rike && RIKE].filter(Boolean);
  return ['in', ['get', 't'], ['literal', types]];
}

export function applyTheme(map, S) {
  const t = THEME[S.tema], P = (id, k, v) => map.setPaintProperty(id, k, v);
  document.documentElement.dataset.tema = S.tema;
  P('bg', 'background-color', t.land); P('wood', 'fill-color', t.wood); P('ice', 'fill-color', t.ice);
  P('water', 'fill-color', t.water);
  P('hill', 'hillshade-shadow-color', t.shadow); P('hill', 'hillshade-highlight-color', t.hi);
  P('k-new', 'fill-color', t.tint); P('k-hover', 'fill-color', t.hover); P('k-sel', 'fill-color', t.sel);
  P('walls', 'fill-extrusion-opacity', t.op);
  P('labels', 'text-color', t.lab); P('labels', 'text-halo-color', t.halo);
  try { map.setSky(t.sky); } catch (e) { }
  try { map.setLight(t.light); } catch (e) { }
}
