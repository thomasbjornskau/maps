// Oppstart og samspill: kart, årsvalg, fylkesfilter, valg av kommune og historikk.
import { maplibregl } from './lib.js';
import { S, syncURL } from './state.js';
import { HOME, FYLKER } from './config.js';
import { fetchJSON, prepare, lineFeatures, linesInFylke, fylkeBounds, fylkerIn, labelFeatures, atomAt } from './data.js';
import { makeHistory } from './history.js';
import { buildStyle, applyYear, applyTheme } from './style.js';
import { $, renderHeader, renderYear, renderKommune, renderLegend, renderTicks } from './ui.js';

let D, H, LFC, hoverCode = null, selCode = null, playing = null, fylkeNow = null;
const tip = $('#tip');

const map = new maplibregl.Map({ container: 'map', hash: 'kart', maxPitch: 82, attributionControl: false, ...HOME, style: buildStyle(S) });
map.on('error', e => console.warn('Kartfeil:', e?.error?.message));
const dataP = Promise.all([fetchJSON('data/meta.json'), fetchJSON('data/atomer.topo.json'), fetchJSON('data/historikk.json')]);

const kNow = () => D.yearState[S.year];
const sKey = () => 's' + kNow();

/* ---------- Fylkesfilter ---------- */
// Fylket følger et punkt, slik at filteret overlever sammenslåinger og delinger av fylker.
function resolveFylke() {
  if (!S.fylke) return null;
  const list = fylkerIn(D, kNow());
  if (list.includes(S.fylke)) return S.fylke;
  const f = S.fpt && atomAt(D, S.fpt[0], S.fpt[1]);
  return f ? f.properties['f' + kNow()] : null;
}
function anchorFor(fylke) {
  const k = kNow(), b = fylkeBounds(D, k, fylke);
  if (!b) return null;
  const cx = (b[0][0] + b[1][0]) / 2, cy = (b[0][1] + b[1][1]) / 2;
  let best = null, bd = Infinity;
  for (const l of D.labelsByState.get(k) || []) {
    if (l.c.slice(0, 2) !== fylke) continue;
    const d = (l.lon - cx) ** 2 + (l.lat - cy) ** 2;
    if (d < bd) { bd = d; best = [l.lon, l.lat]; }
  }
  return best;
}
function fillFylkeSelect() {
  const sel = $('#fylkeSel'), list = fylkerIn(D, kNow());
  sel.innerHTML = `<option value="">Hele landet</option>` + list.map(c => `<option value="${c}">${FYLKER[c] || c} (${c})</option>`).join('');
  sel.value = fylkeNow || '';
  $('#fylkeX').hidden = !fylkeNow;
}
function applyFylke() {
  fylkeNow = resolveFylke();
  if (S.fylke && fylkeNow !== S.fylke) S.fylke = fylkeNow;
  const k = kNow();
  map.setFilter('mask', fylkeNow ? ['!=', ['get', 'f' + k], fylkeNow] : ['==', ['get', 'f0'], '__']);
  map.getSource('lines').setData(fylkeNow ? linesInFylke(D, LFC, k, fylkeNow) : LFC);
  map.getSource('labels').setData(labelFeatures(D, S.year, H.nameAt, fylkeNow));
  fillFylkeSelect();
}
function chooseFylke(code) {
  S.fylke = code || null;
  S.fpt = code ? anchorFor(code) : null;
  applyFylke();
  if (code) {
    const b = fylkeBounds(D, kNow(), code);
    const left = innerWidth >= 900 ? 380 : 30;
    if (b) map.fitBounds(b, { padding: { top: 60, bottom: 130, left, right: innerWidth >= 900 ? 340 : 30 }, duration: 1400, pitch: Math.min(map.getPitch(), 45), maxZoom: 10 });
  } else map.flyTo({ ...HOME, curve: 1.3 });
  syncURL();
}

/* ---------- År og valg ---------- */
function pickSelection() {
  selCode = null;
  if (!S.sel) return;
  const f = atomAt(D, S.sel[0], S.sel[1]);
  if (f && (!fylkeNow || f.properties['f' + kNow()] === fylkeNow)) selCode = f.properties[sKey()];
}
function applyFilters() {
  const k = sKey();
  const prev = D.prevYear(S.year), from = prev && prev < S.year - 1 ? prev + 1 : S.year;
  map.setFilter('k-new', ['in', ['get', k], ['literal', H.changedCodes(S.year, from)]]);
  map.setFilter('k-hover', ['==', ['get', k], hoverCode || '']);
  map.setFilter('k-sel', ['==', ['get', k], selCode || '']);
}
function renderPanel() {
  if (selCode) {
    renderKommune(H, D, selCode, S.year);
    $('#selX').onclick = () => { S.sel = null; selCode = null; applyFilters(); renderPanel(); syncURL(); };
  } else renderYear(H, D, S.year, fylkeNow);
}
// Tidslinjen går over de årene vi har grenser for, ikke over alle kalenderår.
const evYears = () => D.years.filter(y => {
  const p = D.prevYear(y), from = p && p < y - 1 ? p + 1 : y;
  return H.eventYears.some(e => e >= from && e <= y);
});
function syncYearControls() {
  const y = S.year, i = D.index.get(y);
  $('#yr').value = i; $('#tlYear').textContent = y; $('#yearSel').value = y;
  $('#yr').setAttribute('aria-valuetext', `${y}, ${D.counts[y]} kommuner`);
  $('#prevY').disabled = i === 0; $('#nextY').disabled = i === D.years.length - 1;
  const ev = evYears();
  $('#prevEv').disabled = !ev.some(e => e < y); $('#nextEv').disabled = !ev.some(e => e > y);
}
function setYear(y) {
  y = Math.max(D.minYear, Math.min(D.maxYear, Math.round(y)));
  if (!(y in D.yearState)) y = D.years.reduce((b, c) => (Math.abs(c - y) < Math.abs(b - y) ? c : b));
  S.year = y; hoverCode = null;
  applyFylke(); pickSelection(); applyFilters();
  applyYear(map, S, y, D.minYear, D.prevYear(y));
  renderHeader(D, y); renderPanel(); syncYearControls();
  syncURL();
}

/* ---------- Avspilling ---------- */
function stopPlay() { clearInterval(playing); playing = null; $('#play').setAttribute('aria-pressed', 'false'); $('#play').setAttribute('aria-label', 'Spill av'); }
function startPlay() {
  if (S.year >= D.maxYear) setYear(D.minYear);
  $('#play').setAttribute('aria-pressed', 'true'); $('#play').setAttribute('aria-label', 'Pause');
  playing = setInterval(() => { const n = D.nextYear(S.year); n ? setYear(n) : stopPlay(); }, 1200);
}

/* ---------- Peking ---------- */
function codeAt(point) {
  const f = map.queryRenderedFeatures(point, { layers: ['k-pick'] })[0];
  if (!f) return null;
  if (fylkeNow && f.properties['f' + kNow()] !== fylkeNow) return null;
  return f.properties[sKey()];
}
map.on('mousemove', e => {
  if (!D) return;
  const c = codeAt(e.point);
  if (c !== hoverCode) { hoverCode = c; map.setFilter('k-hover', ['==', ['get', sKey()], c || '']); }
  map.getCanvas().style.cursor = c ? 'pointer' : '';
  if (c) {
    tip.innerHTML = `<b>${H.nameAt(c, S.year)}</b> · ${c}`;
    tip.style.display = 'block'; tip.style.left = (e.point.x + 14) + 'px'; tip.style.top = (e.point.y + 14) + 'px';
  } else tip.style.display = 'none';
});
map.on('mouseout', () => { hoverCode = null; if (D) map.setFilter('k-hover', ['==', ['get', sKey()], '']); tip.style.display = 'none'; });
map.on('click', e => {
  if (!D) return;
  S.sel = codeAt(e.point) ? [e.lngLat.lng, e.lngLat.lat] : null;
  pickSelection(); applyFilters(); renderPanel(); syncURL();
  if (innerWidth < 900 && S.sel) togglePanel(true);
});

/* ---------- Kontroller ---------- */
function togglePanel(force) {
  const p = $('#panel'), on = force ?? !p.classList.contains('open');
  p.classList.toggle('open', on); $('#mobToggle').setAttribute('aria-expanded', on);
}
function wireUI() {
  const ys = $('#yearSel'), ev = new Set(evYears());
  D.years.forEach((y, i) => {
    const gap = i && D.years[i - 1] < y - 1;
    ys.add(new Option(`${gap ? '— ' : ''}${y}${ev.has(y) ? ' ●' : ''}`, y));
  });
  ys.onchange = () => { stopPlay(); setYear(+ys.value); };
  $('#prevY').onclick = () => { stopPlay(); setYear(D.prevYear(S.year) ?? S.year); };
  $('#nextY').onclick = () => { stopPlay(); setYear(D.nextYear(S.year) ?? S.year); };
  $('#prevEv').onclick = () => { stopPlay(); const y = [...evYears()].reverse().find(e => e < S.year); if (y) setYear(y); };
  $('#nextEv').onclick = () => { stopPlay(); const y = evYears().find(e => e > S.year); if (y) setYear(y); };
  $('#fylkeSel').onchange = e => chooseFylke(e.target.value);
  $('#fylkeX').onclick = () => chooseFylke('');

  const yr = $('#yr');           // glidebryteren teller posisjoner, ikke år
  yr.min = 0; yr.max = D.years.length - 1;
  yr.addEventListener('input', () => { stopPlay(); setYear(D.years[+yr.value]); });
  $('#play').onclick = () => (playing ? stopPlay() : startPlay());
  document.addEventListener('keydown', e => {
    if (e.target.closest('input,textarea,select,.maplibregl-canvas')) return;
    if (e.key === 'ArrowRight') { stopPlay(); setYear(D.nextYear(S.year) ?? S.year); }
    else if (e.key === 'ArrowLeft') { stopPlay(); setYear(D.prevYear(S.year) ?? S.year); }
    else if (e.key === ' ' && !e.target.closest('button,summary')) { e.preventDefault(); playing ? stopPlay() : startPlay(); }
  });
  $('#panel').addEventListener('click', e => {
    const b = e.target.closest('.yr'); if (!b) return;
    stopPlay(); setYear(+b.dataset.y);
  });
  const toggles = { swKommune: 'kommune', swFylke: 'fylkeL', swRike: 'rike' };
  for (const [id, key] of Object.entries(toggles)) {
    const el = $('#' + id); el.checked = S[key];
    el.onchange = () => { S[key] = el.checked; applyYear(map, S, S.year, D.minYear, D.prevYear(S.year)); renderLegend(S); syncURL(); };
  }
  const swNavn = $('#swNavn'); swNavn.checked = S.navn;
  swNavn.onchange = () => { S.navn = swNavn.checked; map.setLayoutProperty('labels', 'visibility', S.navn ? 'visible' : 'none'); syncURL(); };
  const swNy = $('#swNy'); swNy.checked = S.ny;
  swNy.onchange = () => { S.ny = swNy.checked; map.setLayoutProperty('k-new', 'visibility', S.ny ? 'visible' : 'none'); applyYear(map, S, S.year, D.minYear, D.prevYear(S.year)); renderLegend(S); syncURL(); };
  const swBorte = $('#swBorte'); swBorte.checked = S.borte;
  swBorte.onchange = () => { S.borte = swBorte.checked; applyYear(map, S, S.year, D.minYear, D.prevYear(S.year)); renderLegend(S); syncURL(); };
  const hm = $('#hMult'), fmt = v => v.toLocaleString('nb-NO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '×';
  hm.value = S.k; $('#hMultV').textContent = fmt(S.k);
  hm.oninput = () => { S.k = +hm.value; $('#hMultV').textContent = fmt(S.k); applyYear(map, S, S.year, D.minYear, D.prevYear(S.year)); syncURL(); };

  document.querySelectorAll('.theme button').forEach(b => {
    b.setAttribute('aria-pressed', b.dataset.t === S.tema);
    b.onclick = () => {
      S.tema = b.dataset.t;
      document.querySelectorAll('.theme button').forEach(x => x.setAttribute('aria-pressed', x === b));
      applyTheme(map, S); applyYear(map, S, S.year, D.minYear, D.prevYear(S.year)); renderLegend(S); syncURL();
    };
  });
  document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
    document.querySelectorAll('.tab').forEach(x => x.setAttribute('aria-selected', x === t));
    $('#tab-hist').hidden = t.dataset.tab !== 'hist'; $('#tab-lag').hidden = t.dataset.tab !== 'lag';
  });
  $('#bOversikt').onclick = () => (fylkeNow ? chooseFylke(fylkeNow) : map.flyTo({ ...HOME, curve: 1.3 }));
  $('#bOven').onclick = () => map.easeTo({ pitch: 0, bearing: 0, duration: 1200 });
  $('#bFull').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());
  $('#compass').onclick = () => map.easeTo({ bearing: 0, duration: 600 });
  $('#zin').onclick = () => map.zoomIn(); $('#zout').onclick = () => map.zoomOut();
  map.on('rotate', () => { $('#compass svg').style.transform = `rotate(${-map.getBearing()}deg)`; });
  const dlg = $('#dlg');
  $('#aboutBtn').onclick = $('#aboutLink').onclick = () => dlg.showModal();
  $('#dlgX').onclick = () => dlg.close();
  $('#mobToggle').onclick = () => togglePanel();
}

/* ---------- Oppstart ---------- */
map.on('load', async () => {
  try {
    const [, topo, hist] = await dataP;
    D = prepare(topo, hist); H = makeHistory(D);
    if (!(S.year in D.yearState)) S.year = D.maxYear;
    document.documentElement.dataset.tema = S.tema;
    LFC = lineFeatures(D);
    map.getSource('atoms').setData(D.atoms);
    applyTheme(map, S);
    renderTicks(H, D); renderLegend(S);
    wireUI();
    setYear(S.year);
    $('#loading').classList.add('done');
  } catch (err) {
    console.error(err);
    $('#loading').textContent = 'Klarte ikke å laste dataene. Se konsollen for detaljer.';
  }
});
