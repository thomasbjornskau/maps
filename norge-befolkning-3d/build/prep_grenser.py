"""
Bygger grunnkretsgrensene for kartet.

Leser Geonorges landsfil for grunnkretser (GeoJSON, EPSG:25833, som zip eller
utpakket) og skriver én TopoJSON-fil til docs/data/. Delområder, kommuner og
fylker avledes fra grunnkretsnummeret i nettleseren, så de trenger ingen egne filer.

Bruk:
    python build/prep_grenser.py 2026
    python build/prep_grenser.py 2026 --fil build/input/Basisdata_0000_Norge_25833_Grunnkretser_GeoJSON.zip
    python build/prep_grenser.py 2026 --toleranse 60

Krever Node (npx) for mapshaper: se build/package.json.
"""
import argparse, json, shutil, subprocess, sys, tempfile, zipfile
from pathlib import Path
import geopandas as gpd
from common import INPUT, DATA, load_meta, save_meta, fmt, Report


def find_input(explicit):
    if explicit:
        return Path(explicit)
    c = sorted(INPUT.glob("*Grunnkrets*.zip")) + sorted(INPUT.glob("*Grunnkrets*.geojson"))
    if not c:
        sys.exit(f"Fant ingen grunnkretsfil i {INPUT}")
    return c[-1]


def read(path, tmp):
    if path.suffix == ".zip":
        with zipfile.ZipFile(path) as z:
            name = next((n for n in z.namelist() if "Grunnkrets" in n and n.endswith(".geojson")), None)
            if not name:
                sys.exit(f"Fant ingen grunnkrets-GeoJSON i {path.name}: {z.namelist()}")
            z.extract(name, tmp)
            path = Path(tmp) / name
    return gpd.read_file(path, engine="pyogrio", columns=["grunnkretsnummer", "grunnkretsnavn", "kommunenummer"])


def npx():
    exe = shutil.which("npx") or shutil.which("npx.cmd")
    if not exe:
        sys.exit("Fant ikke npx. Installer Node og kjør «npm install» i build/.")
    return exe


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("aar", type=int, help="årgangen grensene gjelder for, f.eks. 2026")
    ap.add_argument("--fil")
    ap.add_argument("--toleranse", type=int, default=40, help="forenkling i meter (standard 40)")
    a = ap.parse_args()
    src = find_input(a.fil)
    r = Report(f"Grunnkretser {a.aar} fra {src.name}")

    with tempfile.TemporaryDirectory() as tmp:
        g = read(src, tmp)
        gk = g.grunnkretsnummer.astype(str)
        r.check(gk.str.fullmatch(r"\d{8}").all(), f"alle {fmt(len(g))} grunnkretsnumre har 8 sifre")
        r.check(not gk.duplicated().any(), "ingen duplikate grunnkretsnumre")
        r.check(bool((gk.str[:4] == g.kommunenummer.astype(str)).all()), "grunnkretsnummeret starter med kommunenummeret")
        r.check(bool(g.is_valid.all()), "alle geometrier er gyldige")
        if str(g.crs).upper() != "EPSG:25833":
            r.warn(f"Uventet koordinatsystem {g.crs}; transformeres likevel til WGS84")
        n_do, n_k, n_f = gk.str[:6].nunique(), gk.str[:4].nunique(), gk.str[:2].nunique()
        r.info(f"Grunnkretser: {fmt(len(g))}   Delområder: {fmt(n_do)}   Kommuner: {n_k}   Fylker: {n_f}")

        navn_p = DATA / "navn.json"
        if navn_p.exists():
            navn = json.loads(navn_p.read_text(encoding="utf-8"))
            mk = set(gk.str[:4]) - set(navn.get("kommuner", {}))
            mf = set(gk.str[:2]) - set(navn.get("fylker", {}))
            r.check(not mk, f"alle kommunenumre finnes i navn.json" + (f" (mangler {sorted(mk)[:8]})" if mk else ""))
            r.check(not mf, f"alle fylkesnumre finnes i navn.json" + (f" (mangler {sorted(mf)})" if mf else ""))
        else:
            r.warn("navn.json finnes ikke ennå. Kjør prep_navn.py.")

        out = g.assign(gk=gk, n=g.grunnkretsnavn.fillna(""))[["gk", "n", "geometry"]].to_crs(4326)
        tmp_in = Path(tmp) / "gk.geojson"
        out.to_file(tmp_in, driver="GeoJSON", engine="pyogrio")
        name = f"grunnkretser_{a.aar}.topo.json"
        cmd = [npx(), "mapshaper", "-i", str(tmp_in),
               "-simplify", f"interval={a.toleranse}", "keep-shapes", "-clean",
               "-rename-layers", "grunnkretser",
               "-o", "format=topojson", "quantization=400000", str(DATA / name)]
        res = subprocess.run(cmd, capture_output=True, text=True, cwd=Path(__file__).parent)
        if res.returncode != 0:
            sys.exit("mapshaper feilet:\n" + res.stderr)

    topo = json.loads((DATA / name).read_text(encoding="utf-8"))
    r.check(len(topo["objects"]["grunnkretser"]["geometries"]) == len(g), "mapshaper beholdt alle grunnkretser")
    r.print()

    meta = load_meta()
    old = meta.get("grenser", {}).get("fil")
    if old and old != name and (DATA / old).exists():
        (DATA / old).unlink()
        print(f"Slettet gammel fil {old}")
    meta["grenser"] = {"fil": name, "aar": a.aar, "objekt": "grunnkretser", "toleranse_m": a.toleranse,
                       "antall": {"grunnkretser": int(len(g)), "delomrader": int(n_do), "kommuner": int(n_k), "fylker": int(n_f)},
                       "kilde": "Kartverket/SSB, Grunnkretser (Geonorge)"}
    save_meta(meta)
    print(f"Skrev docs/data/{name} ({fmt((DATA / name).stat().st_size)} byte) og meta.json")


if __name__ == "__main__":
    main()
