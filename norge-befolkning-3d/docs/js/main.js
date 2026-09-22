// Oppstart og samspill: kart, data, lag, peking/klikk, kamera og kontroller.
import { maplibregl } from './lib.js';
import { S, syncURL } from './state.js';
import { autoLevel, R250, ZDO, ZGK, HOME, PLACES, TOUR, PAL } from './config.js';
import { fetchJSON, fetchMaybeGzip, decodeCells, cellsFC, cells250Near } from './data.js';
import { buildAreas } from './areas.js';
import { buildStyle, colorExpr, heightExpr, filterExpr, applyTheme, LABEL_LAYERS } from './style.js';
import { $, nf, nf1, sizeLabel, sign, fillMeta, renderNational, renderCell, renderArea, renderLegend, areaTitle } from './ui.js';
import { utmToLonLat as UTM } from './utm.js';

let M, C, A = null, NAMES = { kommuner: {}, fylker: {}, delomrader: {} };
let cur = null, sel = null, hoverId = null, hovArea = null, selArea = null, flying = false, last250 = null;
const tip = $('#tip');

const map = new maplibregl.Map({
  container: 'map', hash: 'kart', maxPitch: 82, attributionControl: false,
  ...HOME, style: buildStyle(S)
});
map.on('error', e => console.warn('Kartfeil:', e?.error?.message));

/* ---------- Data ---------- */
const metaP = fetchJSON('data/meta.json');
const namesP = fetchJSON('data/navn.json').catch(() => null);
const cellsP = metaP.then(m => fetchMaybeGzip('data/' + m.ruter.fil).then(buf => decodeCells(buf, m.ruter)));
const areasP = metaP.then(m => m.grenser ? fetchJSON('data/' + m.grenser.fil).then(t => buildAreas(t, m.grenser.objekt)) : null);

/* ---------- Søyler ---------- */
const levelNow = () => (S.niva === 'auto' ? autoLevel(map.getZoom()) : +S.niva);

function refreshCols(force) {
  if (!C) return;
  const lv = levelNow();
  if (lv === 250) {
    const c = map.getCenter();
    if (force || cur !== 250 || !last250 || Math.hypot(c.lng - last250.lng, (c.lat - last250.lat) * 2) > 0.08) {
      cur = 250; last250 = c;
      const fc = cells250Near(C, c.lng, c.lat, R250);
      map.getSource('cols').setData(fc); clearCellSel();
      $('#stNiva').textContent = `250 m · ${nf.format(fc.features.length)} ruter i utsnittet`;
    }
  } else if (force || lv !== cur) {
    cur = lv;
    const fc = cellsFC(C, lv);
    map.getSource('cols').setData(fc); clearCellSel();
    $('#stNiva').textContent = `${sizeLabel(lv)} · ${nf.format(fc.features.length)} ruter`;
  }
  $('#stAuto').textContent = S.niva === 'auto' ? 'auto' : 'låst';
  $('#nCells').textContent = sizeLabel(cur) + '-ruter';
  map.setPaintProperty('cols', 'fill-extrusion-height', heightExpr(S, cur));
}

function restyleCols() {
  if (cur === null) return;
  map.setPaintProperty('cols', 'fill-extrusion-color', colorExpr(S));
  map.setPaintProperty('cols', 'fill-extrusion-height', heightExpr(S, cur));
  map.setPaintProperty('cols', 'fill-extrusion-opacity', PAL[S.tema].op);
  map.setFilter('cols', filterExpr(S));
  renderLegend(S, M);
}

/* ---------- Peking og valg ---------- */
function setHover(id) {
  if (hoverId !== null) map.setFeatureState({ source: 'cols', id: hoverId }, { hover: false });
  hoverId = id;
  if (id !== null) map.setFeatureState({ source: 'cols', id }, { hover: true });
}
function clearCellSel() {
  if (sel !== null) { try { map.setFeatureState({ source: 'cols', id: sel }, { sel: false }); } catch (e) { } }
  sel = null;
  if (!selArea) renderNational(M);
}
function pickArea(pt) {
  if (!A) return null;
  const z = map.getZoom();
  if (S.gk && z >= ZGK) { const f = map.queryRenderedFeatures(pt, { layers: ['gk-fill'] })[0]; if (f) return { lv: 'gk', p: f.properties }; }
  if (S.do && z >= ZDO) { const f = map.queryRenderedFeatures(pt, { layers: ['do-fill'] })[0]; if (f) return { lv: 'do', p: f.properties }; }
  return null;
}
const areaKey = a => (a ? a.lv + (a.lv === 'gk' ? a.p.gk : a.p.do) : null);
function setAreaHL() {
  const g = [], d = [];
  for (const a of [hovArea, selArea]) if (a) (a.lv === 'gk' ? g : d).push(a.lv === 'gk' ? a.p.gk : a.p.do);
  map.setFilter('gk-hl', ['in', ['get', 'gk'], ['literal', g]]);
  map.setFilter('do-hl', ['in', ['get', 'do'], ['literal', d]]);
}

map.on('mousemove', e => {
  if (!C) return;
  const f = map.queryRenderedFeatures(e.point, { layers: ['cols'] })[0];
  let html = null;
  if (f) {
    setHover(f.id);
    if (hovArea) { hovArea = null; setAreaHL(); }
    const p = f.properties, d = p.pt - p.pf;
    html = `<b>${nf.format(p.pt)}</b> bosatte · ${sizeLabel(p.s)}-rute <span class="${d > 0 ? 'up' : d < 0 ? 'down' : ''}">(${sign(d)})</span>`;
  } else {
    setHover(null);
    const a = pickArea(e.point);
    if (areaKey(a) !== areaKey(hovArea)) { hovArea = a; setAreaHL(); }
    if (a) {
      const t = areaTitle(a, NAMES);
      html = a.lv === 'gk' ? `<b>${t.name}</b> · grunnkrets ${a.p.gk}` : `<b>${t.name}</b> · ${t.kn} · ${a.p.cnt} grunnkretser`;
    }
  }
  map.getCanvas().style.cursor = html ? 'pointer' : '';
  if (html) { tip.innerHTML = html; tip.style.display = 'block'; tip.style.left = (e.point.x + 14) + 'px'; tip.style.top = (e.point.y + 14) + 'px'; }
  else tip.style.display = 'none';
});
map.on('mouseout', () => { setHover(null); hovArea = null; if (A) setAreaHL(); tip.style.display = 'none'; });

function closeAll() { selArea = null; if (A) setAreaHL(); clearCellSel(); renderNational(M); }

map.on('click', e => {
  if (!C) return;
  const f = map.queryRenderedFeatures(e.point, { layers: ['cols'] })[0];
  if (sel !== null) { try { map.setFeatureState({ source: 'cols', id: sel }, { sel: false }); } catch (_) { } sel = null; }
  selArea = null;
  if (f) {
    sel = f.id; map.setFeatureState({ source: 'cols', id: sel }, { sel: true });
    const p = f.properties, c = UTM(p.x + p.s / 2, p.y + p.s / 2), g = A ? A.locate(c[0], c[1]) : null;
    renderCell(p, { kommune: g ? NAMES.kommuner[g.k] : null, gk: g }, M, closeAll);
  } else {
    const a = pickArea(e.point);
    if (a) { selArea = a; renderArea(a, NAMES, M, closeAll); }
    else renderNational(M);
  }
  if (A) setAreaHL();
});

/* ---------- Kamera ---------- */
function setFly(on) { $('#bFly').setAttribute('aria-pressed', on); $('#bFly span').textContent = on ? 'Stopp' : 'Flytur'; }
async function tour() {
  flying = true; setFly(true);
  for (const s of TOUR) {
    if (!flying) break;
    await new Promise(r => { map.once('moveend', r); map.flyTo({ ...s, curve: 1.35 }); });
    if (!flying) break;
    await new Promise(r => setTimeout(r, 1400));
  }
  flying = false; setFly(false);
}
['mousedown', 'touchstart', 'wheel'].forEach(ev => map.on(ev, e => {
  if (flying && e.originalEvent) { flying = false; map.stop(); setFly(false); }
}));

/* ---------- Kontroller ---------- */
function seg(id, key, after) {
  const el = $(id);
  el.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === S[key]));
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    S[key] = b.dataset.v;
    el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    after(); syncURL();
  });
}
function toggle(id, key, layers, after) {
  const sw = $(id); sw.checked = S[key];
  sw.onchange = () => {
    S[key] = sw.checked;
    layers.forEach(l => map.setLayoutProperty(l, 'visibility', S[key] ? 'visible' : 'none'));
    after?.(); syncURL();
  };
}
function areaHints() {
  const z = map.getZoom();
  $('#hintGk').textContent = !S.gk ? 'Vises når du zoomer inn mot en by' : (z >= ZGK ? 'Vises nå' : 'Zoom inn mot en by for å se dem');
  $('#hintDo').textContent = !S.do ? 'Vises når du zoomer inn mot en region' : (z >= ZDO ? 'Vises nå' : 'Zoom inn mot en region for å se dem');
}
function togglePanel(force) {
  const p = $('#panel'), on = force ?? !p.classList.contains('open');
  p.classList.toggle('open', on); $('#mobToggle').setAttribute('aria-expanded', on);
}

function wireUI() {
  seg('#segNiva', 'niva', () => refreshCols(true));
  seg('#segFarge', 'farge', restyleCols);
  seg('#segAar', 'aar', restyleCols);
  const hm = $('#hMult'); hm.value = S.k; $('#hMultV').textContent = nf1.format(S.k) + '×';
  hm.oninput = () => { S.k = +hm.value; $('#hMultV').textContent = nf1.format(S.k) + '×'; if (cur) map.setPaintProperty('cols', 'fill-extrusion-height', heightExpr(S, cur)); syncURL(); };
  $('#swPop').onchange = e => map.setLayoutProperty('cols', 'visibility', e.target.checked ? 'visible' : 'none');
  toggle('#swKomm', 'komm', ['komm-line']);
  toggle('#swFylke', 'fylke', ['fylke-line']);
  toggle('#swGk', 'gk', ['gk-fill', 'gk-line', 'gk-hl'], areaHints);
  toggle('#swDo', 'do', ['do-fill', 'do-line', 'do-hl'], areaHints);
  map.on('zoomend', areaHints); areaHints();

  document.querySelectorAll('.theme button').forEach(b => {
    b.setAttribute('aria-pressed', b.dataset.t === S.tema);
    b.onclick = () => {
      S.tema = b.dataset.t;
      document.querySelectorAll('.theme button').forEach(x => x.setAttribute('aria-pressed', x === b));
      applyTheme(map, S); restyleCols(); syncURL();
    };
  });
  document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
    document.querySelectorAll('.tab').forEach(x => x.setAttribute('aria-selected', x === t));
    $('#tab-lag').hidden = t.dataset.tab !== 'lag'; $('#tab-steder').hidden = t.dataset.tab !== 'steder';
  });
  $('#places').innerHTML = PLACES.map((p, i) => `<button class="place" data-i="${i}"><b>${p[0]}</b><small>${p[1]}</small></button>`).join('');
  $('#places').onclick = e => {
    const b = e.target.closest('.place'); if (!b) return;
    const p = PLACES[+b.dataset.i];
    map.flyTo({ center: p[2], zoom: p[3], pitch: p[4], bearing: p[5], curve: 1.3 });
    if (innerWidth < 900) togglePanel(false);
  };
  $('#bOversikt').onclick = () => map.flyTo({ ...HOME, curve: 1.3 });
  $('#bOven').onclick = () => map.easeTo({ pitch: 0, bearing: 0, duration: 1200 });
  $('#bFly').onclick = () => { if (flying) { flying = false; map.stop(); setFly(false); } else tour(); };
  const bN = $('#bNavn'); bN.setAttribute('aria-pressed', S.navn);
  bN.onclick = () => {
    S.navn = !S.navn; bN.setAttribute('aria-pressed', S.navn);
    LABEL_LAYERS.forEach(id => map.setLayoutProperty(id, 'visibility', S.navn ? 'visible' : 'none')); syncURL();
  };
  $('#bFull').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());
  $('#compass').onclick = () => map.easeTo({ bearing: 0, duration: 600 });
  $('#zin').onclick = () => map.zoomIn(); $('#zout').onclick = () => map.zoomOut();
  map.on('rotate', () => { $('#compass svg').style.transform = `rotate(${-map.getBearing()}deg)`; });
  const dlg = $('#dlg');
  $('#aboutBtn').onclick = $('#aboutLink').onclick = () => dlg.showModal();
  $('#dlgX').onclick = () => dlg.close();
  $('#mobToggle').onclick = () => togglePanel();
  setTimeout(() => { $('#hint').style.opacity = 0; }, 9000);
}

/* ---------- Oppstart ---------- */
map.on('load', async () => {
  try {
    M = await metaP;
    fillMeta(M);
    document.documentElement.dataset.tema = S.tema;
    wireUI();
    renderNational(M);
    C = await cellsP;
    refreshCols(true); applyTheme(map, S); restyleCols();
    $('#loading').classList.add('done');
    map.on('moveend', () => refreshCols(false));
  } catch (err) {
    console.error(err);
    $('#loading').textContent = 'Klarte ikke å laste befolkningsdataene. Se konsollen for detaljer.';
    return;
  }
  // Grenser og navn lastes i bakgrunnen; søylene fungerer uten dem.
  try {
    const [areas, names] = await Promise.all([areasP, namesP]);
    if (names) NAMES = { kommuner: {}, fylker: {}, delomrader: {}, ...names };
    if (areas) {
      A = areas;
      for (const k of ['gkfc', 'dofc', 'gkline', 'doline', 'kommline', 'fylkeline']) map.getSource(k).setData(A[k]);
    }
  } catch (err) {
    console.warn('Grensene kunne ikke lastes:', err);
  }
});
