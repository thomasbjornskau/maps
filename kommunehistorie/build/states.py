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


def build_states(gdb, kv_path, changes):
    states = ssb_states(gdb)
    kv26 = kartverket(kv_path)
    by_year = collections.defaultdict(list)
    for e in changes:
        by_year[int(e['changeOccurred'][:4])].append(e)
    # Kartverket 2026-geometri i 2020-koder (reverser 2024-endringene)
    rev24 = collections.defaultdict(set)
    for e in by_year[2024]:
        rev24[e['newCode']].add(e['oldCode'])
    kv20 = collections.defaultdict(list)
    for c, p in kv26.items():
        o = rev24.get(c, {c})
        assert len(o) == 1, c
        kv20[next(iter(o))].append(p)
    kv20 = {c: unary_union(p) for c, p in kv20.items()}

    s19 = states[-1]
    p20 = apply_changes(s19['polys'], by_year[2020], kv20)
    p24 = apply_changes(p20, by_year[2024], kv26)
    p26 = apply_changes(p24, by_year[2026], kv26)
    states += [
        {'y0': 2020, 'y1': 2023, 'kilde': 'SSB 2019 + Klass', 'lag': 'avledet 2020', 'polys': p20},
        {'y0': 2024, 'y1': 2025, 'kilde': 'SSB 2019 + Klass', 'lag': 'avledet 2024', 'polys': p24},
        {'y0': 2026, 'y1': 2026, 'kilde': 'SSB 2019 + Klass', 'lag': 'avledet 2026', 'polys': p26},
    ]
    return states, kv26, by_year


def expected_codes(states, by_year):
    """Kodesett per år ut fra 2019-geometrien og Klass, for kontroll."""
    codes = set(states[21]['polys'])
    exp = {}
    for y in range(2020, 2027):
        ev = by_year.get(y, [])
        codes = (codes - {e['oldCode'] for e in ev}) | {e['newCode'] for e in ev}
        exp[y] = set(codes)
    return exp
