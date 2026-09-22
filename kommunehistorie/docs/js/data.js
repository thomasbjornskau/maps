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
    cs.forEach((c, k) => { p['s' + k] = c; });
    f.id = i; f.properties = p; f.bb = bbox(f.geometry);
  });
  const labelsByState = new Map();
  for (const [k, c, lon, lat] of hist.navnepunkt) {
    if (!labelsByState.has(k)) labelsByState.set(k, []);
    labelsByState.get(k).push({ c, lon, lat });
  }
  return {
    states, yearState, atoms, arcs: decodeArcs(topo), walls: hist.murer, labelsByState,
    names: hist.navn, events: hist.hendelser, counts: hist.antall,
    minYear: states[0].y0, maxYear: states[states.length - 1].y1
  };
}

// Murene som smale firkanter langs hvert grensesegment på land.
export function wallFeatures(D, halfWidth) {
  const feats = [];
  for (const [ai, land, runs] of D.walls) {
    const c = D.arcs[ai], polys = [];
    for (const [i0, i1] of land) {
      for (let i = i0; i <= i1; i++) {
        const p = c[i], q = c[i + 1];
        const kx = 111320 * Math.cos((p[1] + q[1]) / 2 * Math.PI / 180), ky = 110540;
        const dx = (q[0] - p[0]) * kx, dy = (q[1] - p[1]) * ky, L = Math.hypot(dx, dy);
        if (L < 1) continue;
        const ux = dx / L, uy = dy / L, e = halfWidth * .6, nx = -uy * halfWidth, ny = ux * halfWidth;
        const ax = p[0] - ux * e / kx, ay = p[1] - uy * e / ky, bx = q[0] + ux * e / kx, by = q[1] + uy * e / ky;
        polys.push([[[ax + nx / kx, ay + ny / ky], [bx + nx / kx, by + ny / ky], [bx - nx / kx, by - ny / ky], [ax - nx / kx, ay - ny / ky], [ax + nx / kx, ay + ny / ky]]]);
      }
    }
    if (!polys.length) continue;
    for (const [y0, y1, t] of runs) {
      feats.push({ type: 'Feature', properties: { y0, y1, t }, geometry: { type: 'MultiPolygon', coordinates: polys } });
    }
  }
  return { type: 'FeatureCollection', features: feats };
}

export function labelFeatures(D, year, nameAt) {
  const k = D.yearState[year];
  return {
    type: 'FeatureCollection',
    features: (D.labelsByState.get(k) || []).map(l => ({
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
