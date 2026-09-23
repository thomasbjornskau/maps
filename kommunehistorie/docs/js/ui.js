// Tekst i historikkpanelet, tegnforklaringen og tidslinjen.
import { THEME, KOMMUNE, FYLKE, RIKE, FYLKER } from './config.js';

export const $ = s => document.querySelector(s);
const nf = new Intl.NumberFormat('nb-NO');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function renderHeader(D, Y) {
  $('#hYear').textContent = Y;
  const prev = D.prevYear(Y), n = D.counts[Y], p = prev ? D.counts[prev] : null;
  const diff = p ? n - p : 0;
  const since = prev && prev < Y - 1 ? ` siden ${prev}` : '';
  $('#hSub').innerHTML = `${nf.format(n)} kommuner${diff ? ` <span class="${diff < 0 ? 'down' : 'up'}">(${diff > 0 ? '+' : '−'}${Math.abs(diff)}${esc(since)})</span>` : ''}`;
}

// Årstall i kartets periode er knapper som hopper dit; eldre årstall er bare tekst.
const entry = (y, texts, minYear) => `<li>${y >= minYear
  ? `<button class="yr" data-y="${y}" title="Gå til ${y}">${y}</button>`
  : `<span class="yr old" title="Før kartets periode – bare historikk">${y}</span>`}<div>${texts.map(t => `<p>${esc(t)}</p>`).join('')}</div></li>`;

export function renderYear(H, D, Y, fylke = null) {
  const prev = D.prevYear(Y), from = prev && prev < Y - 1 ? prev + 1 : Y;
  const all = H.yearSummary(Y, from);
  const keep = i => !fylke || i.codes.some(c => c.slice(0, 2) === fylke);
  const s = { major: all.major.filter(keep), nummer: all.nummer.filter(keep), navn: all.navn.filter(keep) };
  const where = fylke ? ` i ${FYLKER[fylke] || fylke}` : '';
  const head = from === Y ? `Endringer 1. januar ${Y}${where}` : `Endringer ${from}–${Y}${where}`;
  let html = `<div class="hh"><span class="lbl">${esc(head)}</span></div>`;
  if (from !== Y) html += `<p class="gap">Kartet hopper fra ${prev} til ${Y}. Årene imellom finnes i historikken, men ikke som grenser.</p>`;
  if (!s.major.length && !s.nummer.length && !s.navn.length) {
    html += `<p class="muted">${Y === D.minYear ? `Kartet starter her. Klikk på en kommune for å se historien helt fra ${D.histFrom}.` : `Ingen endringer i kommuneinndelingen${esc(where)} dette året.`}</p>`;
  } else {
    const cap = 40, major = s.major.slice(0, cap);
    if (major.length) html += `<ul class="ev">${major.map(i => `<li class="${i.kind}">${esc(i.text)}</li>`).join('')}</ul>`;
    if (s.major.length > cap) html += `<details><summary>… og ${s.major.length - cap} endringer til</summary><ul class="ev small">${s.major.slice(cap).map(i => `<li>${esc(i.text)}</li>`).join('')}</ul></details>`;
    if (s.nummer.length) html += `<details><summary>${s.nummer.length} ${s.nummer.length === 1 ? 'kommune' : 'kommuner'} fikk nytt kommunenummer</summary><ul class="ev small">${s.nummer.map(i => `<li>${esc(i.text)}</li>`).join('')}</ul></details>`;
    if (s.navn.length) html += `<details><summary>${s.navn.length} ${s.navn.length === 1 ? 'navneendring' : 'navneendringer'}</summary><ul class="ev small">${s.navn.map(i => `<li>${esc(i.text)}</li>`).join('')}</ul></details>`;
  }
  html += `<p class="note">Klikk på en kommune for å se historien forover og bakover i tid.</p>`;
  $('#hist').innerHTML = html;
}

export function renderKommune(H, D, code, Y) {
  const L = H.lineage(code, Y), sp = H.span(code);
  const first = sp && sp[0] <= D.histFrom ? `fra ${D.histFrom} eller før` : sp?.[0];
  let html = `<div class="hh"><span class="lbl">Valgt kommune</span><button class="x" id="selX" aria-label="Fjern valg">×</button></div>
  <h2 class="kname">${esc(H.nameAt(code, Y))}</h2>
  <p class="kmeta">Kommunenummer ${code}${sp ? ` · brukt ${first}–${sp[1] >= D.maxYear ? 'i dag' : sp[1]}` : ''}</p>`;
  html += `<h3>Bakover i tid</h3>`;
  const inMap = L.back.filter(e => e.y >= D.minYear), before = L.back.filter(e => e.y < D.minYear);
  if (inMap.length) html += `<ol class="tl-list">${inMap.map(e => entry(e.y, e.items.map(i => i.text), D.minYear)).join('')}</ol>`;
  if (before.length) html += `<p class="era">Før ${D.minYear} · bare historikk, ikke grenser</p><ol class="tl-list old">${before.map(e => entry(e.y, e.items.map(i => i.text), D.minYear)).join('')}</ol>`;
  if (!L.back.length) html += `<p class="muted">Ingen endringer i Klass siden ${D.histFrom}.</p>`;
  html += `<h3>Fremover i tid</h3>`;
  html += L.fwd.length ? `<ol class="tl-list">${L.fwd.map(e => entry(e.y, e.items.map(i => i.text), D.minYear)).join('')}</ol>`
    : `<p class="muted">Uendret til og med ${D.maxYear}.</p>`;
  html += `<p class="note">Kartet følger stedet du klikket på. Bla i tid for å se hvilken kommune det tilhørte.</p>`;
  $('#hist').innerHTML = html;
}

export function renderLegend(S) {
  const T = THEME[S.tema];
  const row = (c, t, w, on = true, dash = false) => `<div class="lg${on ? '' : ' off'}"><i style="height:${w}px;background:${dash ? `repeating-linear-gradient(90deg,${c} 0 6px,transparent 6px 10px)` : c}"></i>${t}</div>`;
  $('#legendBox').innerHTML = `<h3>Grenser</h3>
    ${row(T.line[KOMMUNE], 'Kommunegrense', 2, S.kommune)}${row(T.line[FYLKE], 'Fylkesgrense', 3.5, S.fylkeL)}${row(T.line[RIKE], 'Riksgrense', 5, S.rike)}
    <h3 class="h3b">Endringer dette året</h3>
    ${row(T.ny, 'Ny grense siden forrige år i kartet', 3, S.ny)}${row(T.borte, 'Grense som forsvant', 3, S.borte, true)}
    <div class="lg${S.ny ? '' : ' off'}"><i class="fillsw" style="background:${T.tint};opacity:${T.tintOp + .2}"></i>Kommune som ble endret</div>
    <p>Grensene er vist på land. Grensene i sjøen er klippet bort grovt.</p>`;
}

export function renderTicks(H, D) {
  const n = D.years.length - 1;
  const pos = i => i / n;
  const marks = D.years.map((y, i) => {
    const prev = D.prevYear(y), from = prev && prev < y - 1 ? prev + 1 : y;
    const s = H.yearSummary(y, from);
    const w = s.major.length * 3 + s.nummer.length * .25 + s.navn.length * .3;
    return w ? `<i style="--f:${pos(i)};height:${Math.min(22, 4 + Math.log2(1 + w) * 3.2)}px" title="${from === y ? y : from + '–' + y}"></i>` : '';
  }).join('');
  // brudd i tidslinjen der årene ikke henger sammen
  const breaks = D.years.map((y, i) => (i && D.years[i - 1] < y - 1 ? `<u style="--f:${(pos(i) + pos(i - 1)) / 2}"></u>` : '')).join('');
  const labels = D.years.filter((y, i) => i === 0 || i === n || y % 10 === 0 || D.years[i - 1] < y - 1)
    .map(y => `<b style="--f:${pos(D.index.get(y))}">${y}</b>`).join('');
  $('#ticks').innerHTML = marks + breaks + labels;
}
