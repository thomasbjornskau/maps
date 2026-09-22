// Henter og pakker ut befolkningsrutene, og lager søylegeometri per rutestørrelse.
import { utmToLonLat as UTM } from './utm.js';
import { INSET, MIN_BASE_PST } from './config.js';

export async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

// Henter en .gz-fil. Hvis serveren allerede har pakket den ut (Content-Encoding),
// mangler gzip-signaturen, og bufferen brukes som den er.
export async function fetchMaybeGzip(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  const buf = await r.arrayBuffer();
  const u = new Uint8Array(buf, 0, 2);
  if (u[0] !== 0x1f || u[1] !== 0x8b) return buf;
  const s = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(s).arrayBuffer();
}

// Se build/prep_ruter.py for binærformatet.
export function decodeCells(buf, R) {
  const a = new Uint16Array(buf), n = R.n, size = R.storrelse;
  if (a.length !== 4 * n) throw new Error(`Rutefilen har ${a.length} verdier, forventet ${4 * n}`);
  const X = new Int32Array(n), Y = new Int32Array(n), lon = new Float32Array(n), lat = new Float32Array(n);
  let yi = 0;
  for (let i = 0; i < n; i++) {
    yi += a[i];
    X[i] = R.x0 + a[n + i] * size;
    Y[i] = R.y0 + yi * size;
    const ll = UTM(X[i] + size / 2, Y[i] + size / 2);
    lon[i] = ll[0]; lat[i] = ll[1];
  }
  return { n, size, X, Y, lon, lat, pf: a.slice(2 * n, 3 * n), pt: a.slice(3 * n, 4 * n), cache: {} };
}

export function cellFeature(id, x, y, size, pf, pt) {
  const km2 = size * size / 1e6, ins = size * INSET;
  const x0 = x + ins, x1 = x + size - ins, y0 = y + ins, y1 = y + size - ins;
  const ring = [UTM(x0, y0), UTM(x1, y0), UTM(x1, y1), UTM(x0, y1)];
  ring.push(ring[0]);
  const cat = pf === 0 && pt > 0 ? 1 : (pf > 0 && pt === 0 ? 2 : 0);
  return {
    type: 'Feature', id, geometry: { type: 'Polygon', coordinates: [ring] },
    properties: {
      x, y, s: size, pf, pt, df: pf / km2, dt: pt / km2, cd: (pt - pf) / km2,
      rp: pf >= MIN_BASE_PST ? (pt - pf) / pf * 100 : -9999, cat
    }
  };
}

// Summerer 250 m-rutene opp til større ruter i SSBs rutenett (absolutte koordinater).
export function aggregate(C, size) {
  const m = new Map();
  for (let i = 0; i < C.n; i++) {
    const kx = Math.floor(C.X[i] / size), ky = Math.floor(C.Y[i] / size), k = kx * 1e5 + ky;
    let r = m.get(k);
    if (!r) { r = [kx * size, ky * size, 0, 0]; m.set(k, r); }
    r[2] += C.pf[i]; r[3] += C.pt[i];
  }
  return [...m.values()];
}

export function cellsFC(C, size) {
  if (!C.cache[size]) {
    const rows = aggregate(C, size);
    C.cache[size] = { type: 'FeatureCollection', features: rows.map((r, i) => cellFeature(i, r[0], r[1], size, r[2], r[3])) };
  }
  return C.cache[size];
}

// 250 m-ruter innenfor en radius (meter) rundt et punkt.
export function cells250Near(C, lon, lat, R) {
  const cl = Math.cos(lat * Math.PI / 180), dLat = R / 111320, dLon = R / (111320 * cl), out = [];
  for (let i = 0; i < C.n; i++) {
    const a = (C.lat[i] - lat) / dLat, b = (C.lon[i] - lon) / dLon;
    if (a * a + b * b <= 1) out.push(cellFeature(i, C.X[i], C.Y[i], C.size, C.pf[i], C.pt[i]));
  }
  return { type: 'FeatureCollection', features: out };
}
