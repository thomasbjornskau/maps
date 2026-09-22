// Brukerens valg. Leses fra og skrives til URL-en, slik at en visning kan deles.
const q = new URLSearchParams(location.search);
const oneOf = (v, list, def) => (list.includes(v) ? v : def);

export const S = {
  niva: oneOf(q.get('niva'), ['auto', '25000', '5000', '1000', '250'], 'auto'),
  farge: oneOf(q.get('farge'), ['tetthet', 'antall', 'pst'], 'tetthet'),
  aar: oneOf(q.get('aar'), ['til', 'fra'], 'til'),
  tema: oneOf(q.get('tema'), ['dag', 'kveld', 'natt'], 'dag'),
  k: Math.min(3, Math.max(0.25, +(q.get('k') || 1) || 1)),
  komm: q.get('komm') === '1',
  fylke: q.get('fylke') !== '0',
  navn: q.get('navn') !== '0',
  gk: q.get('gk') === '1',
  do: q.get('do') === '1'
};

export function syncURL() {
  const b = v => (v ? 1 : 0);
  const p = new URLSearchParams({
    niva: S.niva, farge: S.farge, aar: S.aar, tema: S.tema, k: S.k,
    komm: b(S.komm), fylke: b(S.fylke), navn: b(S.navn), gk: b(S.gk), do: b(S.do)
  });
  history.replaceState(null, '', location.pathname + '?' + p + location.hash);
}
