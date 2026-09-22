"""
Bygger befolkningsrutene for kartet.

Leser SSBs «Befolkning på rutenett 250 m» (CSV, én fil per år) fra build/input/
og skriver én kompakt binærfil til docs/data/, pluss oppdatert meta.json.

Bruk:
    python build/prep_ruter.py                    # siste år i input/, mot fem år før
    python build/prep_ruter.py --fra 2020 --til 2025

Filnavn i input/ må inneholde «befolkning_250m_ÅÅÅÅ», f.eks.
2026-09-21-befolkning_250m_2025.csv (slik de lastes ned fra kart.ssb.no).

Binærformat (little-endian uint16, fire blokker à n verdier, gzip):
    1. dy    – y-indeks, delta-kodet (rader sortert på y, så x)
    2. xi    – x-indeks
    3. p_fra – bosatte i fra-året
    4. p_til – bosatte i til-året
    Nedre venstre hjørne: X = x0 + xi*250, Y = y0 + yi*250 (EPSG:25833)
"""
import argparse, gzip, re, sys
import numpy as np, pandas as pd
from common import INPUT, DATA, load_meta, save_meta, fmt, Report

SIZE = 250


def find_files():
    out = {}
    for p in INPUT.glob("*.csv"):
        m = re.search(r"befolkning_250m_(\d{4})", p.name)
        if m:
            out[int(m.group(1))] = p
    return out


def read_year(path):
    d = pd.read_csv(path, sep=None, engine="python", encoding="utf-8-sig")
    cols = {c.lower(): c for c in d.columns}
    idc = next((cols[c] for c in cols if c.startswith("ssbid")), None)
    popc = next((cols[c] for c in cols if c.startswith("pop")), None)
    if not idc or not popc:
        sys.exit(f"Fant ikke ID- og befolkningskolonne i {path.name}: {list(d.columns)}")
    s = d.set_index(idc)[popc].astype("int64")
    s.index = s.index.astype("int64")
    return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fra", type=int, help="sammenligningsår (standard: til minus 5)")
    ap.add_argument("--til", type=int, help="siste år (standard: nyeste fil i input/)")
    a = ap.parse_args()
    files = find_files()
    if not files:
        sys.exit(f"Ingen rutefiler i {INPUT}")
    til = a.til or max(files)
    fra = a.fra or til - 5
    for yr in (fra, til):
        if yr not in files:
            sys.exit(f"Mangler fil for {yr}. Fant: {sorted(files)}")

    r = Report(f"Befolkningsruter {fra}–{til}")
    s_fra, s_til = read_year(files[fra]), read_year(files[til])
    for yr, s in ((fra, s_fra), (til, s_til)):
        r.check(not s.index.duplicated().any(), f"{yr}: ingen duplikate rute-ID-er ({fmt(len(s))} ruter)")
        r.check(bool((s > 0).all()), f"{yr}: alle ruter har minst én bosatt")

    u = pd.concat([s_fra.rename("pf"), s_til.rename("pt")], axis=1).fillna(0).astype("int64")
    ids = u.index.values
    x = ids // 10**7 - 2_000_000
    y = ids % 10**7
    r.check(bool(((x % SIZE) == 0).all() and ((y % SIZE) == 0).all()),
            "rute-ID-er dekoder til 250 m-hjørner i EPSG:25833")
    r.check(bool((y > 6_400_000).all() and (y < 8_000_000).all() and (x > -100_000).all() and (x < 1_150_000).all()),
            "alle ruter ligger innenfor fastlands-Norge")

    x0, y0 = int(x.min()), int(y.min())
    xi, yi = (x - x0) // SIZE, (y - y0) // SIZE
    o = np.lexsort((xi, yi))
    xi, yi, pf, pt = xi[o], yi[o], u.pf.values[o], u.pt.values[o]
    dy = np.diff(yi, prepend=0)
    for name, v in (("x-indeks", xi), ("y-delta", dy), (f"bosatte {fra}", pf), (f"bosatte {til}", pt)):
        r.check(bool(v.min() >= 0 and v.max() < 65536), f"{name} får plass i uint16 (maks {fmt(int(v.max()))})")

    sum_fra, sum_til = int(pf.sum()), int(pt.sum())
    nye, tomte = int(((pf == 0) & (pt > 0)).sum()), int(((pf > 0) & (pt == 0)).sum())
    r.info(f"Sum {fra}: {fmt(sum_fra)}   Sum {til}: {fmt(sum_til)}   Endring: {(sum_til/sum_fra-1)*100:+.2f} %")
    r.info(f"Nye ruter: {fmt(nye)}   Tømte ruter: {fmt(tomte)}   Ruter totalt: {fmt(len(xi))}")

    meta = load_meta()
    old = meta.get("ruter")
    if old:
        for yr, v in ((fra, sum_fra), (til, sum_til)):
            prev = old.get("sum", {}).get(str(yr))
            if prev and abs(v / prev - 1) > 0.001:
                r.warn(f"Summen for {yr} avviker {(v/prev-1)*100:+.2f} % fra forrige bygg ({fmt(prev)})")
    r.print()

    arr = np.concatenate([dy, xi, pf, pt]).astype("<u2")
    name = f"ruter_250m_{fra}_{til}.bin.gz"
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / name).write_bytes(gzip.compress(arr.tobytes(), 9))
    if old and old.get("fil") and old["fil"] != name and (DATA / old["fil"]).exists():
        (DATA / old["fil"]).unlink()
        print(f"Slettet gammel fil {old['fil']}")
    meta["ruter"] = {"fil": name, "fra": fra, "til": til, "n": int(len(xi)), "x0": x0, "y0": y0,
                     "storrelse": SIZE, "sum": {str(fra): sum_fra, str(til): sum_til},
                     "nye": nye, "tomte": tomte,
                     "kilde": "SSB, Befolkning på rutenett 250 m, 1. januar (NLOD)"}
    save_meta(meta)
    print(f"Skrev docs/data/{name} ({fmt((DATA / name).stat().st_size)} byte) og meta.json")


if __name__ == "__main__":
    main()
