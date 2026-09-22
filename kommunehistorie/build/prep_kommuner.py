"""
Bygger dataene for kommunekartet 1986–2026.

Inndata i build/input/:
  Historisk_kommstruktur_forbedret.gdb (utpakket) eller zip med den   – SSB, 1986–2019
  Basisdata_0000_Norge_25833_Kommuner_GeoJSON.zip                      – Kartverket, gjeldende
  changes*.json                                                        – Klass 131, endringer (alle filer slås sammen)
  *kommuner_p1838*.geojson (valgfritt)                                 – kommunene i 1838, gir navnene historikken starter med
  ne_10m_land.geojson                                                  – Natural Earth, grov kystlinje
  Basisdata_0000_Norge_25833_KommunerÅÅÅÅ_FGDB.zip (valgfritt)          – Kartverket, historiske årganger

build/kjente_aar.json gir årstall for overføringer som bare kan dateres fra merknadene i Klass.

Bruk:
  python build/prep_kommuner.py
  python build/prep_kommuner.py --toleranse 75 --landbuffer 1000

Utdata i docs/data/: atomer.topo.json, historikk.json, meta.json
"""
import argparse, collections, glob, gzip, json, shutil, subprocess, sys, tempfile, zipfile, datetime
from pathlib import Path
import geopandas as gpd, shapely
from shapely.geometry import box
from states import build_states, expected_codes
from atoms import build_atoms
from walls import build_walls, names_by_year, events, labels

ROOT = Path(__file__).resolve().parent.parent
INPUT, DATA = ROOT / 'build' / 'input', ROOT / 'docs' / 'data'


def find(pattern):
    hits = sorted(glob.glob(str(INPUT / pattern)))
    if not hits: sys.exit(f'Fant ikke {pattern} i {INPUT}')
    return Path(hits[-1])


def unpack(path, tmp, inner):
    if path.suffix != '.zip': return path
    with zipfile.ZipFile(path) as z:
        z.extractall(tmp)
    return Path(sorted(glob.glob(str(Path(tmp) / inner)))[-1])


def npx():
    exe = shutil.which('npx') or shutil.which('npx.cmd')
    if not exe: sys.exit('Fant ikke npx. Installer Node og kjør «npm install» i build/.')
    return exe


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--toleranse', type=int, default=75, help='forenkling i meter')
    ap.add_argument('--landbuffer', type=int, default=1000, help='hvor langt ut i sjøen murene får gå (m)')
    a = ap.parse_args()
    errors = []
    with tempfile.TemporaryDirectory() as tmp:
        gdb_src = next((p for p in [*INPUT.glob('*.gdb'), *INPUT.glob('*.zip')] if not p.name.startswith('Basisdata')), None)
        if not gdb_src: sys.exit('Fant ikke SSBs geodatabase i input/')
        gdb = unpack(gdb_src, tmp, '*.gdb')
        kv = unpack(find('*Kommuner_GeoJSON*'), tmp, '*Kommuner*.geojson')
        seen, changes = set(), []
        for cf in sorted(INPUT.glob('changes*.json')):
            for e in json.load(open(cf, encoding='utf-8'))['codeChanges']:
                k = json.dumps(e, sort_keys=True)
                if k not in seen: seen.add(k); changes.append(e)
        print(f'   Klass-endringer: {len(changes)} fra {min(e["changeOccurred"][:4] for e in changes)} til {max(e["changeOccurred"][:4] for e in changes)}')
        base_names = None
        base = sorted(INPUT.glob('*kommuner_p1838*.geojson'))
        if base:
            bg = gpd.read_file(base[-1], engine='pyogrio', read_geometry=False)
            base_names = dict(zip(bg.komm_nr.astype(str), bg.komm_navn))
        kv_years = {}
        for z in sorted(INPUT.glob('*Kommuner[12][0-9][0-9][0-9]_FGDB.zip')):
            y = int(z.name.split('Kommuner')[1][:4])
            d = Path(tmp) / f'kv{y}'
            with zipfile.ZipFile(z) as zz: zz.extractall(d)
            g = gpd.read_file(next(d.rglob('*.gdb')), layer='kommune', engine='pyogrio', columns=['kommunenummer'])
            kv_years[y] = {c: shapely.union_all(list(gg.geometry)) for c, gg in g.groupby('kommunenummer')}
        print('   Kartverket-årganger:', sorted(kv_years) or 'ingen')
        kj = INPUT.parent / 'kjente_aar.json'
        known = {tuple(k.split('>')): v for k, v in json.load(open(kj, encoding='utf-8')).get('overforinger', {}).items()} if kj.exists() else {}

        print('1/5 Tilstander …')
        states, kv26, by_year, moved, _ = build_states(str(gdb), str(kv), changes, kv_years, known)
        exp = expected_codes(states, by_year)
        tot0 = sum(p.area for p in states[0]['polys'].values())
        for s in states:
            if s['y0'] >= 2020 and set(s['polys']) != exp[s['y0']]:
                errors.append(f"kodesett {s['y0']} avviker fra Klass")
            if abs(sum(p.area for p in s['polys'].values()) / tot0 - 1) > 1e-6:
                errors.append(f"totalareal {s['y0']} avviker")

        print('2/5 Atomer …')
        atoms = build_atoms(states)
        for k, s in enumerate(states):
            ar = collections.Counter()
            for at in atoms: ar[at['c'][k]] += at['g'].area
            for c, g in s['polys'].items():
                if abs(ar[c] - g.area) > 2000: errors.append(f"atomareal {s['y0']} {c}")
        if errors:
            print('\n'.join('FEIL ' + e for e in errors)); sys.exit('Bygget stoppet.')

        print('3/5 Topologi (mapshaper) …')
        def poly_only(g):
            parts = [q for p in shapely.get_parts(g) if p.geom_type in ('Polygon', 'MultiPolygon') for q in shapely.get_parts(p)]
            return shapely.union_all(parts)
        gdf = gpd.GeoDataFrame({'c': ['|'.join(x['c']) for x in atoms]}, geometry=[poly_only(x['g']) for x in atoms], crs=25833)
        src = Path(tmp) / 'atoms.geojson'; gdf.to_file(src, driver='GeoJSON', engine='pyogrio')
        out = DATA / 'atomer.topo.json'
        cmd = [npx(), 'mapshaper', '-i', str(src), 'snap-interval=0.5', '-proj', 'init=EPSG:25833',
               '-simplify', f'interval={a.toleranse}', 'planar', 'keep-shapes', '-clean', 'gap-fill-area=0', 'sliver-control=0',
               '-rename-layers', 'atomer', '-proj', 'wgs84',
               '-o', 'format=topojson', 'quantization=1000000', str(out)]
        r = subprocess.run(cmd, capture_output=True, text=True, cwd=Path(__file__).parent)
        if r.returncode: sys.exit('mapshaper feilet:\n' + r.stderr)

    print('4/5 Murer, navn og hendelser …')
    topo = json.load(open(out, encoding='utf-8'))
    codes = [g['properties']['c'].split('|') for g in topo['objects']['atomer']['geometries']]
    if len(codes) != len(atoms): sys.exit('mapshaper mistet atomer')
    ne = gpd.read_file(find('ne_10m_land*.geojson'), engine='pyogrio', bbox=(3, 57.5, 32, 71.5))
    land = gpd.GeoSeries([shapely.union_all(ne.geometry.values).intersection(box(3, 57.5, 32, 71.5))], crs=4326).to_crs(25833).iloc[0]
    land_b = land.buffer(a.landbuffer); shapely.prepare(land_b)
    walls, wstats = build_walls(topo, codes, states, land_b)
    names, per_year, pre_codes = names_by_year(states, by_year, base_names)
    if pre_codes is not None and pre_codes != set(states[0]['polys']):
        sys.exit(f"Klass-kjeden fra 1838 ender ikke i {states[0]['y0']}-kommunene: {sorted(pre_codes ^ set(states[0]['polys']))[:10]}")
    ev = events(by_year, [(x['c'], x['g'].area) for x in atoms], states, {2024: 2022} if 2021 in kv_years else {})
    lab = labels(states, land)

    print('5/5 Skriver filer …')
    meta_hist_from = min(int(e['changeOccurred'][:4]) for e in changes) - 1 if base_names else states[0]['y0']
    hist = {
        'tilstander': [{'y0': s['y0'], 'y1': s['y1'], 'kilde': s['kilde']} for s in states],
        'antall': {y: len(per_year[y]) for y in sorted(per_year)},
        'historie_fra': meta_hist_from,
        'navn': names, 'hendelser': ev, 'navnepunkt': lab, 'murer': walls
    }
    (DATA / 'historikk.json').write_text(json.dumps(hist, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    meta = {'fra': states[0]['y0'], 'til': states[-1]['y1'], 'historie_fra': min(int(e['changeOccurred'][:4]) for e in changes) - 1 if base_names else states[0]['y0'], 'bygget': datetime.date.today().isoformat(),
            'toleranse_m': a.toleranse, 'landbuffer_m': a.landbuffer, 'atomer': len(atoms), 'murer': len(walls),
            'filer': {'topologi': 'atomer.topo.json', 'historikk': 'historikk.json'}}
    (DATA / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    for f in ('atomer.topo.json', 'historikk.json'):
        b = (DATA / f).read_bytes()
        print(f'  {f}: {len(b):,} byte ({len(gzip.compress(b, 9)):,} komprimert)'.replace(',', ' '))
    print(f"  {len(states)} tilstander, {len(atoms)} atomer, {len(walls)} murstykker ({wstats['bare i sjø']} rene sjøgrenser utelatt)")
    print(f"  {len(ev)} hendelser, {len(lab)} navnepunkt, {len(moved)} arealoverføringer fra Kartverket-årgangene")


if __name__ == '__main__':
    main()
