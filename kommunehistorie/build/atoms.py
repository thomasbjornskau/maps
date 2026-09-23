"""
Steg 2: atomer – de minste flatene som aldri deles av en kommunegrense i noe år.
Hvert atom får én kommunekode per tilstand. En mur står mellom to naboatomer
i de årene de har ulik kode.
"""
import gc
import shapely
from shapely.ops import unary_union

TINY_M2 = 1000        # biter mindre enn dette slås inn i nabobiten i samme atom
MIN_ATOM_M2 = 60000   # ferdige atomer under dette regnes som flis fra ulik digitalisering
MIN_ATOM_WIDTH = 30   # areal/omkrets: tynne remser er flis …
MAX_THIN_M2 = 250000  # … men bare hvis de også er små; ellers er det en ekte arealoverføring


def key(g):
    return shapely.to_wkb(shapely.normalize(g))


def build_atoms(states):
    s0 = states[0]['polys']
    atoms = [{'g': g, 'c': [c]} for c, g in sorted(s0.items())]
    for k in range(1, len(states)):
        prev, cur = states[k - 1]['polys'], states[k]['polys']
        same = {}
        cur_keys = {key(g): c for c, g in cur.items()}
        for c, g in prev.items():
            n = cur_keys.get(key(g))
            if n:
                same[c] = n
        codes = list(cur)
        tree = shapely.STRtree([cur[c] for c in codes])
        nxt = []
        for a in atoms:
            pc = a['c'][-1]
            if pc in same:
                nxt.append({'g': a['g'], 'c': a['c'] + [same[pc]]})
                continue
            idx = tree.query(a['g'])
            pieces = []
            for i in idx:
                inter = a['g'].intersection(cur[codes[i]])
                if not inter.is_empty and inter.area > 0:
                    pieces.append([codes[i], inter])
            if not pieces:
                raise ValueError(f'atom uten kode i tilstand {k}')
            pieces.sort(key=lambda p: -p[1].area)
            if pieces[0][1].area >= a['g'].area * (1 - 1e-6):
                nxt.append({'g': a['g'], 'c': a['c'] + [pieces[0][0]]})
                continue
            big = [p for p in pieces if p[1].area >= TINY_M2]
            tiny = [p for p in pieces if p[1].area < TINY_M2]
            if not big:                      # alle bitene er små: hele atomet får koden med størst overlapp
                nxt.append({'g': a['g'], 'c': a['c'] + [pieces[0][0]]})
                continue
            if tiny:
                big[0][1] = unary_union([big[0][1]] + [t[1] for t in tiny])
            for c, g in big:
                g = shapely.make_valid(g)
                nxt.append({'g': g, 'c': a['c'] + [c]})
        atoms = nxt
        del nxt
        gc.collect()
    return atoms


def is_atom_sliver(g, min_area, min_w):
    return g.area < min_area or (g.area / max(g.length, 1) < min_w and g.area < MAX_THIN_M2)


def drop_slivers(atoms, min_area=MIN_ATOM_M2, min_w=MIN_ATOM_WIDTH):
    """Slår små flis-atomer inn i naboen de deler lengst grense med. Flisene oppstår
    der to kilder har digitalisert samme grense litt ulikt."""
    keep = [a for a in atoms if not is_atom_sliver(a['g'], min_area, min_w)]
    small = [a for a in atoms if is_atom_sliver(a['g'], min_area, min_w)]
    if not small:
        return atoms, 0
    tree = shapely.STRtree([a['g'] for a in keep])
    merged = 0
    for s in sorted(small, key=lambda a: a['g'].area):
        buf = s['g'].buffer(1)            # bare flisen bufres, ikke naboene
        cand = tree.query(buf)
        if not len(cand):
            keep.append(s)
            continue
        best = max(cand, key=lambda i: keep[i]['g'].intersection(buf).area)
        keep[best]['g'] = shapely.make_valid(unary_union([keep[best]['g'], s['g']]))
        merged += 1
    return keep, merged
