// Navn, beskrivelser av endringer og slektslinjer for kommunene, bygget på Klass.
export function makeHistory(D) {
  const N = D.names;
  const byCode = new Map();
  for (const ev of D.events) {
    const codes = ev.t ? ev.t.slice(0, 2) : ev.l.flat();
    for (const c of new Set(codes)) {
      if (!byCode.has(c)) byCode.set(c, []);
      byCode.get(c).push(ev);
    }
  }
  const byYear = new Map();
  for (const ev of D.events) {
    if (!byYear.has(ev.y)) byYear.set(ev.y, []);
    byYear.get(ev.y).push(ev);
  }

  function nameAt(c, y) {
    const r = N[c];
    if (!r) return c;
    let best = r[0], dist = Infinity;
    for (const run of r) {
      if (y >= run[0] && y <= run[1]) return run[2];
      const d = y < run[0] ? run[0] - y : y - run[1];
      if (d < dist) { dist = d; best = run; }
    }
    return best[2];
  }
  const span = c => (N[c] ? [N[c][0][0], N[c][N[c].length - 1][1]] : null);

  function describe(ev) {
    const y = ev.y, out = [];
    if (ev.t) {
      const [p, n, a] = ev.t;
      const when = ev.u ? ` Endringen skjedde en gang mellom ${ev.u[0]} og ${ev.u[1]}.` : '';
      const gone = !N[p] || !N[p].some(r => y >= r[0] && y <= r[1]);
      const text = gone
        ? `Et område fra ${nameAt(p, y - 1)} (ca. ${fmtKm(a)} km² inkl. sjø) ble lagt til ${nameAt(n, y)}.${when}`
        : `${nameAt(p, y)} avga et område til ${nameAt(n, y)} (ca. ${fmtKm(a)} km² inkl. sjø).${when}`;
      out.push({ kind: 'overforing', codes: [p, n], text });
      return out;
    }
    const T = new Map(), Sx = new Map();
    for (const [o, n] of ev.l) {
      if (!T.has(o)) T.set(o, []); T.get(o).push(n);
      if (!Sx.has(n)) Sx.set(n, []); Sx.get(n).push(o);
    }
    const renumber = (o, n) => {
      const a = nameAt(o, y - 1), b = nameAt(n, y);
      return { kind: 'nummer', codes: [o, n], text: a === b ? `${b} fikk nytt kommunenummer ${n} (før ${o})` : `${a} (${o}) ble til ${b} (${n})` };
    };
    if (T.size === 1 && Sx.size === 1) {
      const [o] = T.keys(), [n] = Sx.keys(), a = nameAt(o, y - 1), b = nameAt(n, y);
      if (o === n) { if (a !== b) out.push({ kind: 'navn', codes: [n], text: `${a} fikk navnet ${b}` }); }
      else out.push(renumber(o, n));
      return out;
    }
    // Navnebytte på en kode som fortsetter, inne i en større endring (f.eks. Haus → Arna 1964)
    for (const [o, t] of T) {
      if (t.includes(o) && Sx.get(o).length === 1 && nameAt(o, y - 1) !== nameAt(o, y)) out.push({ kind: 'navn', codes: [o], text: `${nameAt(o, y - 1)} fikk navnet ${nameAt(o, y)}` });
    }
    for (const [o, t] of T) {
      if (t.length < 2) continue;
      if (t.includes(o)) out.push({ kind: 'avgivelse', codes: [o, ...t], text: `${nameAt(o, y - 1)} avga areal til ${list(t.filter(x => x !== o).map(x => nameAt(x, y)))}` });
      else out.push({ kind: 'deling', codes: [o, ...t], text: `${nameAt(o, y - 1)} ble delt mellom ${list(t.map(x => nameAt(x, y)))}` });
    }
    for (const [n, s] of Sx) {
      if (s.length < 2) {
        const o = s[0];
        if (T.get(o).length === 1 && o !== n) out.push(renumber(o, n));
        continue;
      }
      const parts = s.map(o => (T.get(o).length > 1 ? 'del av ' + nameAt(o, y - 1) : nameAt(o, y - 1)));
      out.push({ kind: 'sammen', codes: [n, ...s], text: `${nameAt(n, y)} ble dannet av ${list(parts)}` });
    }
    return out;
  }

  // Alle endringer 1. januar i et gitt år
  function yearSummary(y) {
    const items = (byYear.get(y) || []).flatMap(describe);
    const major = items.filter(i => !['nummer', 'navn'].includes(i.kind));
    const order = { sammen: 0, deling: 1, avgivelse: 2, overforing: 3 };
    major.sort((a, b) => order[a.kind] - order[b.kind] || a.text.localeCompare(b.text, 'nb'));
    return { major, nummer: items.filter(i => i.kind === 'nummer'), navn: items.filter(i => i.kind === 'navn') };
  }

  function changedCodes(y) {
    const out = new Set();
    for (const ev of byYear.get(y) || []) {
      if (ev.t) { ev.t.slice(0, 2).forEach(c => out.add(c)); continue; }
      const olds = new Set(ev.l.map(l => l[0])), news = new Set(ev.l.map(l => l[1]));
      if (olds.size === 1 && news.size === 1) continue;       // bare nytt navn eller nummer
      news.forEach(c => out.add(c));
    }
    return [...out];
  }

  // Slektslinje: hvilke endringer som ledet fram til kommunen, og hva den ble til.
  // Linjen følger kommuner som gikk helt eller delvis opp i en annen, men ikke kommuner
  // som bare avga areal og selv fortsatte – ellers drar én liten overføring med seg
  // hele naboens historie.
  function lineage(code, Y) {
    const subjects = new Set([code]), back = [], fwd = [], seen = new Set();
    const maps = ev => {
      const T = new Map(), Sx = new Map();
      for (const [o, n] of ev.l) {
        if (!T.has(o)) T.set(o, []); T.get(o).push(n);
        if (!Sx.has(n)) Sx.set(n, []); Sx.get(n).push(o);
      }
      return { T, Sx };
    };
    let front = [{ c: code, lim: Y + 1 }];
    for (let g = 0; front.length && g < 80; g++) {
      const { c, lim } = front.shift();
      let best = null;
      for (const ev of byCode.get(c) || []) if (ev.l && ev.y < lim && ev.l.some(l => l[1] === c) && (!best || ev.y > best.y)) best = ev;
      if (!best || seen.has(best)) continue;
      seen.add(best); back.push(best);
      const { T } = maps(best);
      for (const [o, n] of best.l) {
        if (n !== c) continue;
        const onlyGaveArea = o !== c && T.get(o).includes(o);
        if (!onlyGaveArea || o === c) { subjects.add(o); front.push({ c: o, lim: best.y }); }
      }
    }
    front = [{ c: code, lim: Y }];
    for (let g = 0; front.length && g < 80; g++) {
      const { c, lim } = front.shift();
      let best = null;
      for (const ev of byCode.get(c) || []) if (ev.l && ev.y > lim && ev.l.some(l => l[0] === c) && (!best || ev.y < best.y)) best = ev;
      if (!best || seen.has(best)) continue;
      seen.add(best); fwd.push(best);
      const { T, Sx } = maps(best);
      for (const [o, n] of best.l) {
        if (o !== c) continue;
        const onlyGaveArea = n !== c && T.get(c).includes(c) && Sx.get(n).includes(n);
        if (!onlyGaveArea) { subjects.add(n); front.push({ c: n, lim: best.y }); }
      }
    }
    for (const c of subjects) for (const ev of byCode.get(c) || []) {
      if (ev.t && !seen.has(ev)) { seen.add(ev); (ev.y <= Y ? back : fwd).push(ev); }
    }
    // Bare setninger der en av kommunene i linjen er den som endres
    const relevant = i => {
      if (i.kind === 'overforing') return i.codes.some(c => subjects.has(c));
      if (i.kind === 'deling' || i.kind === 'avgivelse') return subjects.has(i.codes[0]) || i.codes.slice(1).some(c => c !== i.codes[0] && subjects.has(c));
      return subjects.has(i.codes[0]);
    };
    const render = evs => evs.map(ev => ({ y: ev.y, items: describe(ev).filter(relevant) })).filter(e => e.items.length);
    return {
      back: render(back).sort((a, b) => b.y - a.y),
      fwd: render(fwd).sort((a, b) => a.y - b.y)
    };
  }

  return { nameAt, span, describe, yearSummary, changedCodes, lineage, eventYears: [...byYear.keys()].sort((a, b) => a - b), byYear };
}

export function list(a) {
  if (a.length < 2) return a.join('');
  return a.slice(0, -1).join(', ') + ' og ' + a[a.length - 1];
}
const fmtKm = v => new Intl.NumberFormat('nb-NO', { maximumFractionDigits: v < 10 ? 1 : 0 }).format(v);
