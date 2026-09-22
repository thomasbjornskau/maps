"""
Steg 1: kommunetilstander 1986–2026 som polygoner i EPSG:25833.

1986–2019: SSBs historiske kommunestruktur (FilGeodatabase), ett lag per periode.
2020–2026: 2019-kommunene videreført med endringene i Klass. Sammenslåinger blir
unioner, omnummereringer får ny kode. Nye indre grenser (delinger, arealoverføringer)
hentes fra Kartverkets kommunefil. Da får hele serien én felles geometri, og
uendrede grenser er identiske i alle år.
"""
import json, re, collections
import geopandas as gpd, pyogrio, shapely
from shapely.ops import unary_union

MIN_PIECE_KM2 = 0.05      # mindre biter fra Kartverket-klipp regnes som flis
MIN_WIDTH_M = 40          # «tynnhet»: areal/omkrets under dette = flis
# Arealoverføringer mindre enn dette er under kartets oppløsning (75 m forenkling) og tas ikke med
TRANSFER_MIN_KM2 = 0.25
TRANSFER_MIN_HALFWIDTH_M = 50   # areal/omkrets ≈ halv bredde for smale flater


def ssb_states(gdb):
    out = []
    for name in pyogrio.list_layers(gdb)[:, 0]:
        tag = name.replace('Hist_kommune_flate_', '')
        m = re.fullmatch(r'(\d{4})(?:til(\d{4}))?', tag)
        y0, y1 = int(m.group(1)), int(m.group(2) or m.group(1))
        g = gpd.read_file(gdb, layer=name, engine='pyogrio')
        g['KOMMUNENR'] = g.KOMMUNENR.astype(str).str.zfill(4)
        polys = {c: shapely.make_valid(unary_union(list(gg.geometry))) for c, gg in g.groupby('KOMMUNENR')}
        names = dict(zip(g.KOMMUNENR, g.NAVN))
        out.append({'y0': y0, 'y1': y1, 'kilde': 'SSB', 'lag': name, 'polys': polys, 'names': names})
    out.sort(key=lambda s: s['y0'])
    for a, b in zip(out, out[1:]):
        assert a['y1'] + 1 == b['y0'], f"hull mellom {a['lag']} og {b['lag']}"
    return out


def kartverket(path):
    d = json.load(open(path, encoding='utf-8-sig'))
    rows = [f for f in d['features'] if f['properties'].get('objtype') == 'Kommune']
    polys = collections.defaultdict(list)
    for f in rows:
        polys[f['properties']['kommunenummer']].append(shapely.geometry.shape(f['geometry']))
    return {c: unary_union(p) for c, p in polys.items()}


def is_sliver(g):
    return g.area < MIN_PIECE_KM2 * 1e6 or g.area / max(g.length, 1) < MIN_WIDTH_M


def clean_piece(g):
    parts = [p for p in shapely.get_parts(g) if p.geom_type == 'Polygon' and not is_sliver(p)]
    return unary_union(parts) if parts else None


def apply_changes(prev, changes, kv_new):
    """Fører en tilstand videre med Klass-endringer for ett årsskifte.
    kv_new: Kartverket-polygoner i de nye kodene (brukes bare ved delinger)."""
    olds = collections.defaultdict(set)
    for e in changes:
        olds[e['oldCode']].add(e['newCode'])
    contrib = collections.defaultdict(list)
    for code, poly in prev.items():
        targets = olds.get(code, {code})
        if len(targets) == 1:
            contrib[next(iter(targets))].append(poly)
            continue
        # Deling eller arealoverføring: klipp mot Kartverket, største mottaker får resten
        pieces = {}
        for n in targets:
            if n in kv_new:
                p = clean_piece(poly.intersection(kv_new[n]))
                if p is not None:
                    pieces[n] = p
        biggest = max(pieces, key=lambda n: pieces[n].area) if pieces else next(iter(targets))
        rest = poly
        for n, p in pieces.items():
            if n != biggest:
                contrib[n].append(p)
                rest = rest.difference(p)
        contrib[biggest].append(rest)
    return {c: shapely.make_valid(unary_union(ps)) for c, ps in contrib.items()}


def real_parts(g, min_km2=MIN_PIECE_KM2, min_w=MIN_WIDTH_M):
    return [p for p in shapely.get_parts(g) if p.geom_type == 'Polygon'
            and p.area >= min_km2 * 1e6 and p.area / max(p.length, 1) >= min_w]


def kv_transfers(kv_a, kv_b, targets):
    """Arealbiter som skifter kommune mellom to Kartverket-årganger uten at Klass-kodene
    forklarer det. targets: kode i a → mulige koder i b etter Klass."""
    codes = list(kv_b)
    tree = shapely.STRtree([kv_b[c] for c in codes])
    out = []
    for c, g in kv_a.items():
        for i in tree.query(g):
            n = codes[i]
            if n in targets.get(c, {c}):
                continue
            inter = g.intersection(kv_b[n])
            if inter.is_empty:
                continue
            parts = real_parts(inter)
            if parts:
                out.append((c, n, unary_union(parts)))
    return out


def apply_transfers(polys, transfers, recode=lambda c: c):
    """Flytter bitene til mottakeren. Biten klippes mot giveren i vår (SSB-baserte) geometri,
    slik at bare den nye indre grensen kommer fra Kartverket."""
    polys = dict(polys)
    codes = list(polys)
    moved = []
    for src, dst, piece in transfers:
        dst = recode(dst)
        if dst not in polys:
            continue
        donor = max((c for c in codes if c != dst), key=lambda c: polys[c].intersection(piece).area)
        p = polys[donor].intersection(piece)
        parts = real_parts(p, TRANSFER_MIN_KM2, TRANSFER_MIN_HALFWIDTH_M)
        if not parts:
            continue
        p = unary_union(parts)
        polys[donor] = shapely.make_valid(polys[donor].difference(p))
        polys[dst] = shapely.make_valid(unary_union([polys[dst], p]))
        moved.append((donor, dst, p.area))
    return polys, moved


def code_targets(codes, by_year, y0, y1):
    m = {c: {c} for c in codes}
    for y in range(y0 + 1, y1 + 1):
        step = collections.defaultdict(set)
        for e in by_year.get(y, []):
            step[e['oldCode']].add(e['newCode'])
        m = {c: set().union(*[step.get(x, {x}) for x in t]) for c, t in m.items()}
    return m


def build_states(gdb, kv_path, changes, kv_years=None, known_years=None):
    """kv_years: {år: {kode: polygon}} fra Kartverkets historiske kommunefiler (valgfritt).
    known_years: {(fra, til): år} for overføringer som bare kan dateres fra merknadene i Klass."""
    states = ssb_states(gdb)
    kv26 = kartverket(kv_path)
    by_year = collections.defaultdict(list)
    for e in changes:
        by_year[int(e['changeOccurred'][:4])].append(e)
    rev24 = collections.defaultdict(set)
    for e in by_year[2024]:
        rev24[e['newCode']].add(e['oldCode'])
    to20 = lambda c: next(iter(rev24.get(c, {c})))
    kv20 = collections.defaultdict(list)
    for c, p in kv26.items():
        kv20[to20(c)].append(p)
    kv20 = {c: unary_union(p) for c, p in kv20.items()}
    KV = dict(kv_years or {})
    KV.setdefault(2026, kv26)
    known = known_years or {}
    log = []

    def trans(a, b):
        if a in KV and b in KV:
            return kv_transfers(KV[a], KV[b], code_targets(KV[a], by_year, a, b))
        return []

    s19 = states[-1]['polys']
    p20 = apply_changes(s19, by_year[2020], KV.get(2020, kv20))
    p20, m = apply_transfers(p20, trans(2019, 2020)); log += [(2020, *x) for x in m]
    seq = [(2020, 2023, p20)]
    if 2021 in KV:
        p21, m = apply_transfers(p20, trans(2020, 2021)); log += [(2021, *x) for x in m]
        t2124 = trans(2021, 2024)
        early = [t for t in t2124 if known.get((t[0], t[1])) == 2022]
        late = [t for t in t2124 if known.get((t[0], t[1])) != 2022]
        p22, m = apply_transfers(p21, early, recode=to20); log += [(2022, *x) for x in m]
        seq = [(2020, 2020, p20), (2021, 2021, p21), (2022, 2023, p22)]
        base = p22
    else:
        late, base = [], p20
    p24 = apply_changes(base, by_year[2024], KV.get(2024, kv26))
    p24, m = apply_transfers(p24, late); log += [(2024, *x, 'usikker') for x in m]
    p25, m = apply_transfers(p24, trans(2024, 2025)); log += [(2025, *x) for x in m]
    p26 = apply_changes(p25, by_year[2026], kv26)
    p26, m = apply_transfers(p26, trans(2025, 2026)); log += [(2026, *x) for x in m]
    seq += [(2024, 2024, p24), (2025, 2025, p25), (2026, 2026, p26)]
    for y0, y1, p in seq:
        states.append({'y0': y0, 'y1': y1, 'kilde': 'SSB 2019 + Klass + Kartverket', 'lag': f'avledet {y0}', 'polys': p})
    uncertain = {(2024, d, t) for (y, d, t, a, *u) in log if u}
    return states, kv26, by_year, log, uncertain

def expected_codes(states, by_year):
    """Kodesett per år ut fra 2019-geometrien og Klass, for kontroll."""
    codes = set(states[21]['polys'])
    exp = {}
    for y in range(2020, 2027):
        ev = by_year.get(y, [])
        codes = (codes - {e['oldCode'] for e in ev}) | {e['newCode'] for e in ev}
        exp[y] = set(codes)
    return exp
