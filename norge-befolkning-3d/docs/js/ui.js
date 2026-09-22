// Innhold i infokort, tegnforklaring og tekster som hentes fra meta.json.
import { PAL, DENS_BR, CHG_BR, PST_BR, MIN_BASE_PST } from './config.js';

export const $ = s => document.querySelector(s);
export const nf = new Intl.NumberFormat('nb-NO');
export const nf1 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
export const sizeLabel = s => (s >= 1000 ? s / 1000 + ' km' : s + ' m');
export const sign = v => (v > 0 ? '+' : v < 0 ? '−' : '±') + nf.format(Math.abs(v));
export const signP = v => (v > 0 ? '+' : v < 0 ? '−' : '±') + nf1.format(Math.abs(v)) + ' %';
const cls = v => (v > 0 ? 'up' : v < 0 ? 'down' : '');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CLOSE = `<button class="selx" aria-label="Fjern valg"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;

// Fyller alle elementer med data-meta="…" fra meta.json
export function fillMeta(M) {
  const R = M.ruter, G = M.grenser || { antall: {} };
  const v = {
    fra: R.fra, til: R.til, 'sum-fra': nf.format(R.sum[R.fra]), 'sum-til': nf.format(R.sum[R.til]),
    nye: nf.format(R.nye), tomte: nf.format(R.tomte), 'n-ruter': nf.format(R.n),
    grenseaar: G.aar ?? '–', toleranse: G.toleranse_m ?? '–', minbase: MIN_BASE_PST,
    'n-grunnkretser': nf.format(G.antall.grunnkretser ?? 0), 'n-delomrader': nf.format(G.antall.delomrader ?? 0),
    'n-kommuner': nf.format(G.antall.kommuner ?? 0), 'n-fylker': nf.format(G.antall.fylker ?? 0)
  };
  document.querySelectorAll('[data-meta]').forEach(el => { if (el.dataset.meta in v) el.textContent = v[el.dataset.meta]; });
}

export function renderNational(M) {
  const R = M.ruter, a = R.sum[R.fra], b = R.sum[R.til];
  const box = $('#infoBox');
  box.classList.remove('sel');
  box.innerHTML = `<div class="ih"><span><b>Hele landet</b> · sum over rutene</span></div>
  <div class="big"><strong>${nf.format(b)}</strong><span>bosatte ${R.til}</span></div>
  <div class="kv"><div><small>${R.fra}</small><b>${nf.format(a)}</b></div>
  <div><small>Endring</small><b class="${cls(b - a)}">${signP((b - a) / a * 100)}</b></div></div>
  <div class="foot">Klikk på en søyle eller et område for detaljer.<br>${esc(R.kilde)}</div>`;
}

export function renderCell(p, ctx, M, onClose) {
  const R = M.ruter, d = p.pt - p.pf;
  const pc = p.pf > 0 ? signP(d / p.pf * 100) : (p.pt > 0 ? 'ny rute' : '–');
  const id = (p.x + 2e6) * 1e7 + p.y, g = ctx.gk;
  const box = $('#infoBox');
  box.classList.add('sel');
  box.innerHTML = `<div class="ih"><span><b>Valgt rute</b> · ${sizeLabel(p.s)}${ctx.kommune ? ' · ' + esc(ctx.kommune) : ''}</span>${CLOSE}</div>
  <div class="big"><strong>${nf.format(p.pt)}</strong><span>bosatte ${R.til}</span></div>
  <div class="kv"><div><small>${R.fra}</small><b>${nf.format(p.pf)}</b></div>
  <div><small>Endring</small><b class="${cls(d)}">${sign(d)}</b></div>
  <div><small>Per km² (${R.til})</small><b>${nf.format(Math.round(p.dt))}</b></div>
  <div><small>Endring i %</small><b>${pc}</b></div></div>
  <div class="foot">${g ? `Grunnkrets ${esc(g.n)} (${g.gk}), delområde ${g.do}<br>` : ''}SSB-rute-ID ${id}<br>UTM33 ${nf.format(p.x)} / ${nf.format(p.y)} (nedre venstre hjørne)${g ? '<br>Kommune og grunnkrets gjelder rutas midtpunkt' : ''}</div>`;
  box.querySelector('.selx').onclick = onClose;
}

export function areaTitle(a, names) {
  const p = a.p, kn = names.kommuner[p.k] || p.k;
  if (a.lv === 'gk') return { head: 'Grunnkrets', kn, name: p.n || p.gk };
  const dn = names.delomrader[p.do];
  return { head: 'Delområde', kn, name: dn || `Delområde ${p.do.slice(4)}`, hasName: !!dn };
}

export function renderArea(a, names, M, onClose) {
  const p = a.p, isGk = a.lv === 'gk', t = areaTitle(a, names), yr = M.grenser?.aar ?? '';
  const box = $('#infoBox');
  box.classList.add('sel');
  box.innerHTML = `<div class="ih"><span><b>${t.head}</b> · ${esc(t.kn)}</span>${CLOSE}</div>
  <div class="big"><strong style="font-size:${t.name.length > 14 ? 24 : 30}px">${esc(t.name)}</strong></div>
  <div class="kv">${isGk
      ? `<div><small>Grunnkretsnummer</small><b>${p.gk}</b></div><div><small>Delområde</small><b>${p.do}</b></div>`
      : `<div><small>Delområdenummer</small><b>${p.do}</b></div><div><small>Grunnkretser</small><b>${p.cnt}</b></div>`}</div>
  <div class="foot">${!isGk && !t.hasName ? 'Delområdenavn fra Klass er ikke koblet på ennå.<br>' : ''}Befolkningstall per ${isGk ? 'grunnkrets' : 'delområde'} kobles på fra Statistikkbanken.<br>Grenser: Kartverket/SSB, ${yr}</div>`;
  box.querySelector('.selx').onclick = onClose;
}

export function renderLegend(S, M) {
  const P = PAL[S.tema], R = M.ruter;
  const fmtS = v => (v > 0 ? '+' : v < 0 ? '−' : '') + nf.format(Math.abs(v));
  let h, cols, ticks, cats = '';
  if (S.farge === 'tetthet') { h = `Bosatte per km², ${S.aar === 'til' ? R.til : R.fra}`; cols = P.dens; ticks = DENS_BR.map(v => nf.format(v)); }
  else if (S.farge === 'antall') { h = `Endring ${R.fra}–${R.til}, per km²`; cols = P.chg; ticks = CHG_BR.map(fmtS); }
  else { h = `Endring ${R.fra}–${R.til}, prosent`; cols = P.pst; ticks = PST_BR.map(fmtS); }
  if (S.farge !== 'tetthet') {
    cats = `<div class="cats"><span><i style="background:${P.nyC}"></i>Ny rute</span><span><i style="background:${P.tomC}"></i>Tømt rute</span>${S.farge === 'pst' ? `<span><i style="background:${P.few}"></i>Under ${MIN_BASE_PST} bosatte</span>` : ''}</div>`;
  }
  $('#legendBox').innerHTML = `<h3>${h}</h3>
  <div class="ramp">${cols.map(c => `<i style="background:${c}"></i>`).join('')}</div>
  <div class="ticks">${ticks.map((t, i) => `<span style="left:${(i + 1) / cols.length * 100}%">${t}</span>`).join('')}</div>${cats}
  <div class="hleg"><div class="bars">${[[100, 10], [1000, 31.6], [10000, 100]].map(([v, p]) => `<div><i style="height:${Math.max(3, p * .4)}px"></i>${nf.format(v)}</div>`).join('')}</div>
  <p>Høyden følger kvadratroten av bosatte per km². Skalaen justeres når rutestørrelsen skifter.</p></div>`;
}
