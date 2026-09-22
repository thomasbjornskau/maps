// Grunnkretser, delområder, kommuner og fylker fra én TopoJSON-topologi.
// Nummeret bærer hierarkiet: FF KK DD GG → fylke (2), kommune (4), delområde (6), grunnkrets (8).
// Fordi alt kommer fra samme topologi, ligger grensene nøyaktig oppå hverandre.
import { topojson } from './lib.js';

export function buildAreas(topo, objName = 'grunnkretser') {
  const obj = topo.objects[objName];
  if (!obj) throw new Error(`Fant ikke objektet «${objName}» i grensefilen`);
  for (const g of obj.geometries) {
    const c = g.properties.gk;
    Object.assign(g.properties, { do: c.slice(0, 6), k: c.slice(0, 4), f: c.slice(0, 2) });
  }
  const gkfc = topojson.feature(topo, obj);
  for (const f of gkfc.features) f.bb = bbox(f.geometry);

  const groups = new Map();
  for (const g of obj.geometries) {
    const a = groups.get(g.properties.do);
    a ? a.push(g) : groups.set(g.properties.do, [g]);
  }
  const dofc = {
    type: 'FeatureCollection',
    features: [...groups].map(([d, gs]) => ({
      type: 'Feature', properties: { do: d, k: d.slice(0, 4), cnt: gs.length }, geometry: topojson.merge(topo, gs)
    }))
  };
  const mesh = test => ({ type: 'Feature', properties: {}, geometry: topojson.mesh(topo, obj, test) });
  return {
    gkfc, dofc,
    gkline: mesh((a, b) => a !== b),
    doline: mesh((a, b) => a !== b && a.properties.do !== b.properties.do),
    kommline: mesh((a, b) => a !== b && a.properties.k !== b.properties.k),
    fylkeline: mesh((a, b) => a !== b && a.properties.f !== b.properties.f),
    locate: (x, y) => locate(gkfc.features, x, y)
  };
}

function bbox(g) {
  const b = [180, 90, -180, -90], polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const p of polys) for (const pt of p[0]) {
    if (pt[0] < b[0]) b[0] = pt[0]; if (pt[1] < b[1]) b[1] = pt[1];
    if (pt[0] > b[2]) b[2] = pt[0]; if (pt[1] > b[3]) b[3] = pt[1];
  }
  return b;
}

function inRing(x, y, r) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i], b = r[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

// Finner grunnkretsen som inneholder punktet (partallsregel, håndterer hull).
function locate(features, x, y) {
  for (const f of features) {
    const b = f.bb;
    if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
    const g = f.geometry, polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    let c = false;
    for (const poly of polys) for (const r of poly) if (inRing(x, y, r)) c = !c;
    if (c) return f.properties;
  }
  return null;
}
