// Oppstart og samspill: kart, tidslinje, murer, valg og historikk.
import { maplibregl } from './lib.js';
import { S, syncURL } from './state.js';
import { HOME, widthFor } from './config.js';
import { fetchJSON, prepare, wallFeatures, labelFeatures, atomAt } from './data.js';
import { makeHistory } from './history.js';
import { buildStyle, wallHeight, wallColor, wallFilter, applyTheme } from './style.js';
import { $, renderHeader, renderYear, renderKommune, renderLegend, renderTicks } from './ui.js';

let D, H, T = null, anim = 0, width = null, hoverCode = null, selCode = null, playing = null;
const tip = $('#tip');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

const map = new maplibregl.Map({ container: 'map', hash: 'kart', maxPitch: 82, attributionControl: false, ...HOME, style: buildStyle(S) });
map.on('error', e => console.warn('Kartfeil:', e?.error?.message));

const dataP = Promise.all([fetchJSON('data/meta.json'), fetchJSON('data/atomer.topo.json'), fetchJSON('data/historikk.json')]);

/* ---------- Murer ---------- */
function rebuildWalls(force) {
  const w = widthFor(map.getZoom());
  if (!force && w === width) return;
  width = w;
  map.getSource('walls').setData(wallFeatures(D, w));
}
function paintWalls(animating) {
  map.setPaintProperty('walls', 'fill-extrusion-height', wallHeight(T, S.year, S, animating));
  map.setPaintProperty('walls', 'fill-extrusion-color', wallColor(S.year, S, D.minYear, animating));
}
function animateTo(target) {
  cancelAnimationFrame(anim);
  const from = T ?? target;
  if (reduce || from === target) { T = target; paintWalls(false); return; }
  const dur = Math.min(1800, 350 + 170 * Math.abs(target - from)), t0 = performance.now();
  const step = now => {
    const u = Math.min(1, (now - t0) / dur), e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    T = from + (target - from) * e;
    paintWalls(u < 1);
    if (u < 1) anim = requestAnimationFrame(step);
  };
  anim = requestAnimationFrame(step);
}

/* ---------- År og valg ---------- */
const stateKey = () => 's' + D.yearState[S.year];

function pickSelection() {
  selCode = null;
  if (!S.sel) return;
  const f = atomAt(D, S.sel[0], S.sel[1]);
  if (f) selCode = f.properties[stateKey()];
}
function applyFilters() {
  const k = stateKey();
  map.setFilter('k-new', ['in', ['get', k], ['literal', H.changedCodes(S.year)]]);
  map.setFilter('k-hover', ['==', ['get', k], hoverCode || '']);
  map.setFilter('k-sel', ['==', ['get', k], selCode || '']);
}
function renderPanel() {
  if (selCode) {
    renderKommune(H, D, selCode, S.year);
    $('#selX').onclick = () => { S.sel = null; selCode = null; applyFilters(); renderPanel(); syncURL(); };
  } else renderYear(H, D, S.year);
}
function setYear(y, animate = true) {
  y = Math.max(D.minYear, Math.min(D.maxYear, Math.round(y)));
  S.year = y;
  $('#yr').value = y; $('#tlYear').textContent = y;
  $('#yr').setAttribute('aria-valuetext', `${y}, ${D.counts[y]} kommuner`);
  hoverCode = null;
  pickSelection(); applyFilters();
  map.getSource('labels').setData(labelFeatures(D, y, H.nameAt));
  renderHeader(D, y); renderPanel();
  if (animate) animateTo(y); else { T = y; paintWalls(false); }
  syncURL();
}

/* ---------- Avspilling ---------- */
function stopPlay() { clearInterval(playing); playing = null; $('#play').setAttribute('aria-pressed', 'false'); $('#play').setAttribute('aria-label', 'Spill av'); }
function startPlay() {
  if (S.year >= D.maxYear) setYear(D.minYear, false);
  $('#play').setAttribute('aria-pressed', 'true'); $('#play').setAttribute('aria-label', 'Pause');
  playing = setInterval(() => { if (S.year >= D.maxYear) stopPlay(); else setYear(S.year + 1); }, 1400);
}

/* ---------- Peking ---------- */
map.on('mousemove', e => {
  if (!D) return;
  const f = map.queryRenderedFeatures(e.point, { layers: ['k-pick'] })[0];
  const c = f ? f.properties[stateKey()] : null;
  if (c !== hoverCode) { hoverCode = c; map.setFilter('k-hover', ['==', ['get', stateKey()], c || '']); }
  map.getCanvas().style.cursor = c ? 'pointer' : '';
  if (c) {
    tip.innerHTML = `<b>${H.nameAt(c, S.year)}</b> · ${c}`;
    tip.style.display = 'block'; tip.style.left = (e.point.x + 14) + 'px'; tip.style.top = (e.point.y + 14) + 'px';
  } else tip.style.display = 'none';
});
map.on('mouseout', () => { hoverCode = null; if (D) map.setFilter('k-hover', ['==', ['get', stateKey()], '']); tip.style.display = 'none'; });
map.on('click', e => {
  if (!D) return;
  const f = map.queryRenderedFeatures(e.point, { layers: ['k-pick'] })[0];
  S.sel = f ? [e.lngLat.lng, e.lngLat.lat] : null;
  pickSelection(); applyFilters(); renderPanel(); syncURL();
  if (innerWidth < 900 && S.sel) togglePanel(true);
});

/* ---------- Kontroller ---------- */
function togglePanel(force) {
  const p = $('#panel'), on = force ?? !p.classList.contains('open');
  p.classList.toggle('open', on); $('#mobToggle').setAttribute('aria-expanded', on);
}
function wireUI() {
  const yr = $('#yr');
  yr.min = D.minYear; yr.max = D.maxYear;
  yr.addEventListener('input', () => { stopPlay(); setYear(+yr.value); });
  $('#play').onclick = () => (playing ? stopPlay() : startPlay());
  document.addEventListener('keydown', e => {
    if (e.target.closest('input,textarea,select,.maplibregl-canvas')) return;   // glidebryter og kart har egne taster
    if (e.key === 'ArrowRight') { stopPlay(); setYear(S.year + 1); }
    else if (e.key === 'ArrowLeft') { stopPlay(); setYear(S.year - 1); }
    else if (e.key === ' ' && !e.target.closest('button,summary')) { e.preventDefault(); playing ? stopPlay() : startPlay(); }
  });
  $('#panel').addEventListener('click', e => {
    const b = e.target.closest('.yr'); if (!b) return;
    stopPlay(); setYear(+b.dataset.y);
  });
  const toggles = { swKommune: 'kommune', swFylke: 'fylke', swRike: 'rike' };
  for (const [id, key] of Object.entries(toggles)) {
    const el = $('#' + id); el.checked = S[key];
    el.onchange = () => { S[key] = el.checked; map.setFilter('walls', wallFilter(S)); renderLegend(S); syncURL(); };
  }
  const swNavn = $('#swNavn'); swNavn.checked = S.navn;
  swNavn.onchange = () => { S.navn = swNavn.checked; map.setLayoutProperty('labels', 'visibility', S.navn ? 'visible' : 'none'); syncURL(); };
  const swNy = $('#swNy'); swNy.checked = S.ny;
  swNy.onchange = () => { S.ny = swNy.checked; map.setLayoutProperty('k-new', 'visibility', S.ny ? 'visible' : 'none'); paintWalls(false); renderLegend(S); syncURL(); };
  const swBorte = $('#swBorte'); swBorte.checked = S.borte;
  swBorte.onchange = () => { S.borte = swBorte.checked; paintWalls(false); renderLegend(S); syncURL(); };
  const hm = $('#hMult'), fmt = v => v.toLocaleString('nb-NO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '×';
  hm.value = S.k; $('#hMultV').textContent = fmt(S.k);
  hm.oninput = () => { S.k = +hm.value; $('#hMultV').textContent = fmt(S.k); paintWalls(false); syncURL(); };

  document.querySelectorAll('.theme button').forEach(b => {
    b.setAttribute('aria-pressed', b.dataset.t === S.tema);
    b.onclick = () => {
      S.tema = b.dataset.t;
      document.querySelectorAll('.theme button').forEach(x => x.setAttribute('aria-pressed', x === b));
      applyTheme(map, S); paintWalls(false); renderLegend(S); syncURL();
    };
  });
  document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
    document.querySelectorAll('.tab').forEach(x => x.setAttribute('aria-selected', x === t));
    $('#tab-hist').hidden = t.dataset.tab !== 'hist'; $('#tab-lag').hidden = t.dataset.tab !== 'lag';
  });
  $('#bOversikt').onclick = () => map.flyTo({ ...HOME, curve: 1.3 });
  $('#bOven').onclick = () => map.easeTo({ pitch: 0, bearing: 0, duration: 1200 });
  $('#bFull').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());
  $('#compass').onclick = () => map.easeTo({ bearing: 0, duration: 600 });
  $('#zin').onclick = () => map.zoomIn(); $('#zout').onclick = () => map.zoomOut();
  map.on('rotate', () => { $('#compass svg').style.transform = `rotate(${-map.getBearing()}deg)`; });
  map.on('zoomend', () => rebuildWalls(false));
  const dlg = $('#dlg');
  $('#aboutBtn').onclick = $('#aboutLink').onclick = () => dlg.showModal();
  $('#dlgX').onclick = () => dlg.close();
  $('#mobToggle').onclick = () => togglePanel();
}

/* ---------- Oppstart ---------- */
map.on('load', async () => {
  try {
    const [meta, topo, hist] = await dataP;
    D = prepare(topo, hist); H = makeHistory(D);
    if (!(S.year in D.yearState)) S.year = D.maxYear;
    document.documentElement.dataset.tema = S.tema;
    map.getSource('atoms').setData(D.atoms);
    rebuildWalls(true);
    map.setFilter('walls', wallFilter(S));
    applyTheme(map, S);
    renderTicks(H, D); renderLegend(S);
    wireUI();
    setYear(S.year, false);
    $('#loading').classList.add('done');
  } catch (err) {
    console.error(err);
    $('#loading').textContent = 'Klarte ikke å laste dataene. Se konsollen for detaljer.';
  }
});
