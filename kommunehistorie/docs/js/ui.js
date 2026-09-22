// Tekst i historikkpanelet, tegnforklaringen og tidslinjen.
import { THEME, KOMMUNE, FYLKE, RIKE, FYLKER } from './config.js';

export const $ = s => document.querySelector(s);
const nf = new Intl.NumberFormat('nb-NO');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function renderHeader(D, Y) {
  $('#hYear').textContent = Y;
  const n = D.counts[Y], p = D.counts[Y - 1];
  const diff = p ? n - p : 0;
  $('#hSub').innerHTML = `${nf.format(n)} kommuner${diff ? ` <span class="${diff < 0 ? 'down' : 'up'}">(${diff > 0 ? '+' : '−'}${Math.abs(diff)})</span>` : ''}`;
}

const entry = (y, texts) => `<li><button class="yr" data-y="${y}" title="Gå til ${y}">${y}</button><div>${texts.map(t => `<p>${esc(t)}</p>`).join('')}</div></li>`;

export function renderYear(H, D, Y, fylke = null) {
  const all = H.yearSummary(Y);
  const keep = i => !fylke || i.codes.some(c => c.slice(0, 2) === fylke);
  const s = { major: all.major.filter(keep), nummer: all.nummer.filter(keep), navn: all.navn.filter(keep) };
  const where = fylke ? ` i ${FYLKER[fylke] || fylke}` : '';
  let html = `<div class="hh"><span class="lbl">Endringer 1. januar ${Y}${esc(where)}</span></div>`;
  if (!s.major.length && !s.nummer.length && !s.navn.length) {
    html += `<p class="muted">${Y === D.minYear ? 'Kartet starter her. SSBs digitale kommunegrenser går ikke lenger tilbake.' : `Ingen endringer i kommuneinndelingen${esc(where)} dette året.`}</p>`;
  } else {
    if (s.major.length) html += `<ul class="ev">${s.major.map(i => `<li class="${i.kind}">${esc(i.text)}</li>`).join('')}</ul>`;
    if (s.nummer.length) html += `<details><summary>${s.nummer.length} ${s.nummer.length === 1 ? 'kommune' : 'kommuner'} fikk nytt kommunenummer</summary><ul class="ev small">${s.nummer.map(i => `<li>${esc(i.text)}</li>`).join('')}</ul></details>`;
    if (s.navn.length) html += `<details><summary>${s.navn.length} ${s.navn.length === 1 ? 'navneendring' : 'navneendringer'}</summary><ul class="ev small">${s.navn.map(i => `<li>${esc(i.text)}</li>`).join('')}</ul></details>`;
  }
  html += `<p class="note">Klikk på en kommune for å se historien forover og bakover i tid.</p>`;
  $('#hist').innerHTML = html;
}

export function renderKommune(H, D, code, Y) {
  const L = H.lineage(code, Y), sp = H.span(code);
  const first = sp && sp[0] <= D.minYear ? `før ${D.minYear}` : sp?.[0];
  let html = `<div class="hh"><span class="lbl">Valgt kommune</span><button class="x" id="selX" aria-label="Fjern valg">×</button></div>
  <h2 class="kname">${esc(H.nameAt(code, Y))}</h2>
  <p class="kmeta">Kommunenummer ${code}${sp ? ` · brukt ${first}–${sp[1] >= D.maxYear ? 'i dag' : sp[1]}` : ''}</p>`;
  html += `<h3>Bakover i tid</h3>`;
  html += L.back.length ? `<ol class="tl-list">${L.back.map(e => entry(e.y, e.items.map(i => i.text))).join('')}</ol>`
    : `<p class="muted">Ingen endringer siden ${D.minYear}. Dataene går ikke lenger tilbake.</p>`;
  html += `<h3>Fremover i tid</h3>`;
  html += L.fwd.length ? `<ol class="tl-list">${L.fwd.map(e => entry(e.y, e.items.map(i => i.text))).join('')}</ol>`
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
    ${row(T.ny, 'Ny grense', 3, S.ny)}${row(T.borte, 'Grense som forsvant', 3, S.borte, true)}
    <div class="lg${S.ny ? '' : ' off'}"><i class="fillsw" style="background:${T.tint};opacity:${T.tintOp + .2}"></i>Kommune som ble endret</div>
    <p>Grensene er vist på land. Grensene i sjøen er klippet bort grovt.</p>`;
}

export function renderTicks(H, D) {
  const span = D.maxYear - D.minYear;
  const w = y => {
    const s = H.yearSummary(y), n = s.major.length * 3 + s.nummer.length * .25 + s.navn.length * .3;
    return Math.min(22, 4 + Math.log2(1 + n) * 3.2);
  };
  $('#ticks').innerHTML = H.eventYears.filter(y => y >= D.minYear && y <= D.maxYear)
    .map(y => `<i style="--f:${(y - D.minYear) / span};height:${w(y)}px" title="${y}"></i>`).join('')
    + [1990, 2000, 2010, 2020].map(y => `<b style="--f:${(y - D.minYear) / span}">${y}</b>`).join('');
}
