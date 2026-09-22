"""
Steg 3: fra atomtopologien til murer, navn, hendelser og navnepunkter.
"""
import collections
import numpy as np, shapely
from pyproj import Transformer

KOMMUNE, FYLKE, RIKE = 1, 2, 3
TO_UTM = Transformer.from_crs(4326, 25833, always_xy=True)


def decode_arcs(topo):
    sx, sy = topo['transform']['scale']; tx, ty = topo['transform']['translate']
    out = []
    for arc in topo['arcs']:
        a = np.cumsum(np.array(arc, dtype=np.int64), axis=0)
        out.append(np.column_stack([a[:, 0] * sx + tx, a[:, 1] * sy + ty]))
    return out


def arc_owners(topo):
    """Hvilke atomer som bruker hver bue (1 = yttergrense, 2 = indre grense)."""
    own = collections.defaultdict(list)
    for gi, g in enumerate(topo['objects']['atomer']['geometries']):
        polys = g['arcs'] if g['type'] == 'MultiPolygon' else [g['arcs']]
        for poly in polys:
            for ring in poly:
                for a in ring:
                    own[a if a >= 0 else ~a].append(gi)
    return own


def land_runs(coords, land_utm):
    """Segmentområder [i0, i1] der segmentets midtpunkt ligger på (grovt) land."""
    mid = (coords[:-1] + coords[1:]) / 2
    x, y = TO_UTM.transform(mid[:, 0], mid[:, 1])
    on = shapely.contains_xy(land_utm, x, y)
    runs, start = [], None
    for i, v in enumerate(on):
        if v and start is None: start = i
        if not v and start is not None: runs.append([start, i - 1]); start = None
    if start is not None: runs.append([start, len(on) - 1])
    return runs


def state_runs(types, states):
    """Typer per tilstand → [[fra år, til år, type], …] for sammenhengende like typer."""
    out = []
    for k, t in enumerate(types):
        if not t: continue
        y0, y1 = states[k]['y0'], states[k]['y1']
        if out and out[-1][2] == t and out[-1][1] + 1 == y0:
            out[-1][1] = y1
        else:
            out.append([y0, y1, t])
    return out


def build_walls(topo, codes, states, land_utm):
    arcs = decode_arcs(topo)
    own = arc_owners(topo)
    walls, stats = [], collections.Counter()
    for ai, coords in enumerate(arcs):
        o = own.get(ai, [])
        if len(o) == 1:
            types = [RIKE] * len(states)
        elif len(o) == 2:
            a, b = codes[o[0]], codes[o[1]]
            types = [FYLKE if a[k][:2] != b[k][:2] else KOMMUNE if a[k] != b[k] else 0 for k in range(len(states))]
        else:
            stats['bue med >2 eiere'] += 1
            continue
        runs = state_runs(types, states)
        if not runs:
            continue
        land = land_runs(coords, land_utm)
        if not land:
            stats['bare i sjø'] += 1
            continue
        walls.append([ai, land, runs])
        stats['murer'] += 1
    return walls, stats


def names_by_year(states, changes_by_year):
    """Navn per kode og år. 1986–2019 fra SSB-lagene, deretter videreført med Klass."""
    per_year = {}
    for s in states:
        if 'names' in s:
            for y in range(s['y0'], s['y1'] + 1):
                per_year[y] = dict(s['names'])
    for y in range(2020, 2027):
        cur = dict(per_year[y - 1])
        ev = changes_by_year.get(y, [])
        for e in ev: cur.pop(e['oldCode'], None)
        for e in ev: cur[e['newCode']] = e['newName']
        per_year[y] = cur
    # Klass-navn også for tidligere navnebytter (1988–2019), slik at skrivemåten følger Klass
    for y in range(1987, 2020):
        for e in changes_by_year.get(y, []):
            if e['newCode'] in per_year[y]:
                per_year[y][e['newCode']] = e['newName']
    runs = collections.defaultdict(list)
    for y in sorted(per_year):
        for c, n in per_year[y].items():
            r = runs[c]
            if r and r[-1][2] == n and r[-1][1] == y - 1: r[-1][1] = y
            else: r.append([y, y, n])
    return dict(runs), per_year


def events(changes_by_year, atoms_codes, states):
    """Klass-endringer gruppert i sammenhengende komponenter per år, pluss
    grensejusteringer som bare finnes i geometrien."""
    out = []
    for y in sorted(changes_by_year):
        links = [(e['oldCode'], e['newCode']) for e in changes_by_year[y]]
        parent = {}
        def f(x):
            parent.setdefault(x, x)
            while parent[x] != x: parent[x] = parent[parent[x]]; x = parent[x]
            return x
        for o, n in links: parent[f('o' + o)] = f('n' + n)
        comp = collections.defaultdict(list)
        for o, n in links: comp[f('o' + o)].append([o, n])
        for c in comp.values(): out.append({'y': y, 'l': sorted(c)})
    # Geometriske overføringer mellom kommuner som finnes begge år, uten Klass-kobling
    klass = {(y, o, n) for y, ch in changes_by_year.items() for e in ch for o, n in [(e['oldCode'], e['newCode'])]}
    for k in range(1, len(states)):
        y = states[k]['y0']
        prev_codes, cur_codes = set(states[k - 1]['polys']), set(states[k]['polys'])
        moved = collections.Counter()
        for codes, area in atoms_codes:
            p, n = codes[k - 1], codes[k]
            if p != n and p in cur_codes and n in prev_codes and (y, p, n) not in klass:
                moved[(p, n)] += area
        for (p, n), a in moved.items():
            if a >= 0.05e6:
                out.append({'y': y, 't': [p, n, round(a / 1e6, 2)]})
    return out


def labels(states, land_utm):
    """Navnepunkt per tilstand og kode: inne i den største landbiten av kommunen."""
    to_ll = Transformer.from_crs(25833, 4326, always_xy=True)
    cache, out = {}, []
    for k, s in enumerate(states):
        for c, g in s['polys'].items():
            key = shapely.to_wkb(shapely.normalize(g))
            if key not in cache:
                onland = g.intersection(land_utm)
                parts = [p for p in shapely.get_parts(onland) if p.geom_type == 'Polygon'] if not onland.is_empty else []
                target = max(parts, key=lambda p: p.area) if parts else g
                pt = target.representative_point()
                cache[key] = [round(v, 4) for v in to_ll.transform(pt.x, pt.y)]
            out.append([k, c, *cache[key]])
    return out
