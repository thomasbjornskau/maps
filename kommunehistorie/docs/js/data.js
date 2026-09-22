// Henter topologi og historikk, og lager atomflater, murer og navnepunkter.
import { topojson } from './lib.js';

export async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

function decodeArcs(topo) {
  const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
  return topo.arcs.map(arc => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; });
  });
}

function bbox(g) {
  const b = [180, 90, -180, -90], polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const p of polys) for (const [x, y] of p[0]) {
    if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y;
  }
  return b;
}

export function prepare(topo, hist) {
  const states = hist.tilstander, yearState = {};
  states.forEach((s, k) => { for (let y = s.y0; y <= s.y1; y++) yearState[y] = k; });
  const atoms = topojson.feature(topo, topo.objects.atomer);
  atoms.features.forEach((f, i) => {
    const cs = f.properties.c.split('|'), p = { i };
    cs.forEach((c, k) => { p['s' + k] = c; p['f' + k] = c.slice(0, 2); });
    f.id = i; f.properties = p; f.bb = bbox(f.geometry);
  });
  // Hvilke atomer som ligger på hver side av hver bue
  const owners = new Map();
  topo.objects.atomer.geometries.forEach((g, gi) => {
    const polys = g.type === 'MultiPolygon' ? g.arcs : [g.arcs];
    for (const poly of polys) for (const ring of poly) for (const a of ring) {
      const k = a >= 0 ? a : ~a;
      if (!owners.has(k)) owners.set(k, []);
      owners.get(k).push(gi);
    }
  });
  const labelsByState = new Map();
  for (const [k, c, lon, lat] of hist.navnepunkt) {
    if (!labelsByState.has(k)) labelsByState.set(k, []);
    labelsByState.get(k).push({ c, lon, lat });
  }
  return {
    states, yearState, atoms, owners, arcs: decodeArcs(topo), walls: hist.murer, labelsByState,
    names: hist.navn, events: hist.hendelser, counts: hist.antall,
    minYear: states[0].y0, maxYear: states[states.length - 1].y1, histFrom: hist.historie_fra ?? states[0].y0
  };
}

// Grenselinjene: én linje per grensestykke og periode, bare delene på land.
// a og b er atomene på hver side (b = −1 for riksgrensen), brukt av fylkesfilteret.
export function lineFeatures(D) {
  const feats = [];
  for (const [ai, land, runs] of D.walls) {
    const c = D.arcs[ai], lines = land.map(([i0, i1]) => c.slice(i0, i1 + 2));
    const own = D.owners.get(ai) || [];
    const a = own[0] ?? -1, b = own.length > 1 ? own[1] : -1;
    for (const [y0, y1, t] of runs) {
      feats.push({ type: 'Feature', properties: { y0, y1, t, a, b }, geometry: { type: 'MultiLineString', coordinates: lines } });
    }
  }
  return { type: 'FeatureCollection', features: feats };
}

// Bare linjene som berører et fylke i tilstand k
export function linesInFylke(D, fc, k, fylke) {
  const key = 'f' + k, at = D.atoms.features;
  return {
    type: 'FeatureCollection',
    features: fc.features.filter(f => {
      const { a, b } = f.properties;
      return (a >= 0 && at[a].properties[key] === fylke) || (b >= 0 && at[b].properties[key] === fylke);
    })
  };
}

export function fylkeBounds(D, k, fylke) {
  const key = 'f' + k, b = [180, 90, -180, -90];
  for (const f of D.atoms.features) {
    if (f.properties[key] !== fylke) continue;
    b[0] = Math.min(b[0], f.bb[0]); b[1] = Math.min(b[1], f.bb[1]);
    b[2] = Math.max(b[2], f.bb[2]); b[3] = Math.max(b[3], f.bb[3]);
  }
  return b[0] <= b[2] ? [[b[0], b[1]], [b[2], b[3]]] : null;
}

export function fylkerIn(D, k) {
  const s = new Set();
  for (const f of D.atoms.features) s.add(f.properties['f' + k]);
  return [...s].sort();
}

export function labelFeatures(D, year, nameAt, fylke = null) {
  const k = D.yearState[year];
  return {
    type: 'FeatureCollection',
    features: (D.labelsByState.get(k) || []).filter(l => !fylke || l.c.slice(0, 2) === fylke).map(l => ({
      type: 'Feature', properties: { c: l.c, n: nameAt(l.c, year) }, geometry: { type: 'Point', coordinates: [l.lon, l.lat] }
    }))
  };
}

function inRing(x, y, r) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i], b = r[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

// Atomet som inneholder punktet (brukes for å følge et valgt sted gjennom årene).
export function atomAt(D, x, y) {
  for (const f of D.atoms.features) {
    const b = f.bb;
    if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
    const g = f.geometry, polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    let c = false;
    for (const p of polys) for (const r of p) if (inRing(x, y, r)) c = !c;
    if (c) return f;
  }
  return null;
}
