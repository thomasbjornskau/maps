// Brukerens valg, lest fra og skrevet til URL-en.
const q = new URLSearchParams(location.search);
const oneOf = (v, list, def) => (list.includes(v) ? v : def);
const flag = (k, def) => (q.has(k) ? q.get(k) === '1' : def);
const pt = q.get('pkt')?.split(',').map(Number);
const fpt = q.get('fpkt')?.split(',').map(Number);
const okPt = p => (p && p.length === 2 && p.every(Number.isFinite) ? p : null);

export const S = {
  year: +q.get('aar') || null,
  sel: okPt(pt),
  fylke: /^\d{2}$/.test(q.get('fylke') || '') ? q.get('fylke') : null,
  fpt: okPt(fpt),
  tema: oneOf(q.get('tema'), ['dag', 'kveld', 'natt'], 'dag'),
  k: Math.min(3, Math.max(0.3, +(q.get('k') || 1) || 1)),
  kommune: flag('vk', true), fylkeL: flag('vf', true), rike: flag('vr', true),
  navn: flag('navn', true), ny: flag('ny', true), borte: flag('borte', true)
};

export function syncURL() {
  const b = v => (v ? 1 : 0);
  const p = new URLSearchParams({
    aar: S.year, tema: S.tema, k: S.k, vk: b(S.kommune), vf: b(S.fylkeL), vr: b(S.rike),
    navn: b(S.navn), ny: b(S.ny), borte: b(S.borte)
  });
  if (S.sel) p.set('pkt', S.sel.map(v => v.toFixed(4)).join(','));
  if (S.fylke) { p.set('fylke', S.fylke); if (S.fpt) p.set('fpkt', S.fpt.map(v => v.toFixed(4)).join(',')); }
  history.replaceState(null, '', location.pathname + '?' + p + location.hash);
}
