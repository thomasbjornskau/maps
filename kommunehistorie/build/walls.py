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


def names_before(base, changes_by_year, first_geo_year):
    """Navneperioder før geometrien starter: utgangsnavnene (f.eks. 1838) ført fram med Klass."""
    y_start = min(changes_by_year) - 1 if changes_by_year else first_geo_year
    cur = {c: [n, y_start] for c, n in base.items()}
    runs = collections.defaultdict(list)
    for y in sorted(k for k in changes_by_year if k < first_geo_year):
        ev = changes_by_year[y]
        for e in ev:
            if e['oldCode'] in cur:
                n, since = cur.pop(e['oldCode'])
                runs[e['oldCode']].append([since, y - 1, n])
        for e in ev:
            cur[e['newCode']] = [e['newName'], y]
    for c, (n, since) in cur.items():
        runs[c].append([since, first_geo_year - 1, n])
    return runs, set(cur)


def names_by_year(states, changes_by_year, base_names=None):
    """Navn per kode og år. Fra første geometriår: SSB-lagene, deretter videreført med Klass.
    Før det: utgangsnavnene (base_names) ført fram med Klass-endringene."""
    per_year = {}
    for s in states:
        if 'names' in s:
            for y in range(s['y0'], s['y1'] + 1):
                per_year[y] = dict(s['names'])
    first = states[0]['y0']
    for y in range(2020, 2027):
        cur = dict(per_year[y - 1])
        ev = changes_by_year.get(y, [])
        for e in ev: cur.pop(e['oldCode'], None)
        for e in ev: cur[e['newCode']] = e['newName']
        per_year[y] = cur
    for y in range(first + 1, 2020):
        for e in changes_by_year.get(y, []):
            if e['newCode'] in per_year[y]:
                per_year[y][e['newCode']] = e['newName']
    runs = collections.defaultdict(list)
    pre_codes = None
    if base_names:
        pre, pre_codes = names_before(base_names, changes_by_year, first)
        for c, r in pre.items():
            runs[c].extend(r)
    for y in sorted(per_year):
        for c, n in per_year[y].items():
            r = runs[c]
            if r and r[-1][2] == n and r[-1][1] == y - 1: r[-1][1] = y
            else: r.append([y, y, n])
    for c in runs: runs[c].sort()
    return dict(runs), per_year, pre_codes


def events(changes_by_year, atoms_codes, states, uncertain_from=None):
    """Klass-endringer gruppert i sammenhengende komponenter per år, pluss arealoverføringer
    som bare finnes i geometrien. uncertain_from: {år: tidligste år} for overføringer som bare
    kan dateres til et intervall."""
    uncertain_from = uncertain_from or {}
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
    klass = {(y, e['oldCode'], e['newCode']) for y, ch in changes_by_year.items() for e in ch}
    for k in range(1, len(states)):
        y = states[k]['y0']
        moved = collections.Counter()
        for codes, area in atoms_codes:
            p, n = codes[k - 1], codes[k]
            if p != n and (y, p, n) not in klass:
                moved[(p, n)] += area
        for (p, n), a in moved.items():
            # Ren omnummerering uten Klass-lenke finnes ikke; alt her er flyttet areal
            if a >= 0.05e6:
                ev = {'y': y, 't': [p, n, round(a / 1e6, 2)]}
                if y in uncertain_from: ev['u'] = [uncertain_from[y], y]
                out.append(ev)
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
