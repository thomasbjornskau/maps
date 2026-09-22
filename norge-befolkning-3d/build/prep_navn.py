"""
Bygger navnetabellen (kommuner, fylker, delområder) for kartet.

Kilde bør være SSBs klassifikasjoner i Klass (dataportal.ssb.no/classifications),
lastet ned som CSV for samme år som grunnkretsgrensene:
    - Kommuneinndeling           (Klass 131)
    - Fylkesinndeling            (Klass 104)
    - Grunnkretser og delområder (Klass 1), valgfritt: gir delområdenavn

Bruk:
    python build/prep_navn.py 2026 --kommuner klass_131.csv --fylker klass_104.csv [--grunnkretser klass_1.csv]

Skriptet leter etter kolonner som heter code/kode og name/navn, og for Klass 1
etter en nivåkolonne (level/nivå) der nivå 1 er delområder. Klass-eksporten kan
endre format. Stemmer ikke kolonnene, stopper skriptet og viser hva det fant.
"""
import argparse, json, sys
from pathlib import Path
import pandas as pd
from common import DATA, INPUT, fmt


def read_klass(path):
    p = Path(path)
    if not p.exists():
        p = INPUT / path
    for enc in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            d = pd.read_csv(p, sep=None, engine="python", dtype=str, encoding=enc)
            break
        except UnicodeDecodeError:
            continue
    cols = {c.lower().strip('"'): c for c in d.columns}
    code = cols.get("code") or cols.get("kode")
    name = cols.get("name") or cols.get("navn")
    level = cols.get("level") or cols.get("nivå") or cols.get("niva")
    if not code or not name:
        sys.exit(f"{p.name}: fant ikke kode- og navnekolonne. Kolonner: {list(d.columns)}")
    return d, code, name, level


def table(path, width):
    d, c, n, _ = read_klass(path)
    return {str(k).zfill(width): v for k, v in zip(d[c], d[n])}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("aar", type=int)
    ap.add_argument("--kommuner", required=True)
    ap.add_argument("--fylker", required=True)
    ap.add_argument("--grunnkretser")
    a = ap.parse_args()
    out = {"aar": a.aar, "kilde": "SSB, Klass",
           "kommuner": table(a.kommuner, 4), "fylker": table(a.fylker, 2), "delomrader": {}}
    if a.grunnkretser:
        d, c, n, lv = read_klass(a.grunnkretser)
        if lv:
            d = d[d[lv].astype(str) == "1"]
        else:
            print("ADVARSEL: fant ingen nivåkolonne; bruker koder som ender på 00 som delområder")
            d = d[d[c].str.len() == 8][d[c].str.endswith("00")]
        out["delomrader"] = {str(k)[:6]: v for k, v in zip(d[c], d[n])}
    (DATA / "navn.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Skrev navn.json: {len(out['kommuner'])} kommuner, {len(out['fylker'])} fylker, "
          f"{fmt(len(out['delomrader']))} delområder")


if __name__ == "__main__":
    main()
