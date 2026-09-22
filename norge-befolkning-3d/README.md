# Norge 3D – der folk bor, rute for rute

Et utforskbart 3D-kart over Norge med befolkningen på SSBs rutenett som søyler,
og grunnkretser, delområder, kommuner og fylker som grenselag.
Søsterkart til Stokkøya-kartet i *norway-charts*.

## Struktur

```
docs/                     ← nettsiden (det GitHub Pages publiserer)
├── index.html
├── style.css
├── js/
│   ├── main.js           oppstart og samspill
│   ├── lib.js            eksterne bibliotek (MapLibre, topojson-client) – versjoner pinnes her
│   ├── config.js         soner, skalaer, farger, temaer, steder og flytur
│   ├── state.js          brukerens valg, lest fra og skrevet til URL-en
│   ├── data.js           henting og utpakking av ruter, aggregering, søylegeometri
│   ├── areas.js          grunnkretser → delområder, kommuner, fylker; punkt-i-polygon
│   ├── style.js          kartstil og uttrykk for søylene
│   ├── ui.js             infokort, tegnforklaring, tekster fra meta.json
│   └── utm.js            UTM33 → lengde/bredde
└── data/
    ├── meta.json         hvilke filer og årganger som gjelder – koden leser alt herfra
    ├── ruter_250m_ÅÅÅÅ_ÅÅÅÅ.bin.gz
    ├── grunnkretser_ÅÅÅÅ.topo.json
    └── navn.json         kommune-, fylkes- og delområdenavn

build/                    ← byggeskript, publiseres ikke
├── prep_ruter.py
├── prep_grenser.py
├── prep_navn.py
├── common.py
├── requirements.txt      Python-pakker
├── package.json          mapshaper (Node)
└── input/                kildefiler – committes ikke
```

## Publisering på GitHub Pages

1. Lag et repo og push innholdet i denne mappen.
2. *Settings → Pages → Build and deployment*: velg **Deploy from a branch**, gren `main`, mappe **`/docs`**.
3. Siden ligger på `https://<bruker>.github.io/<repo>/` etter et minutt eller to.

`docs/.nojekyll` gjør at GitHub serverer filene som de er, uten Jekyll.

## Kjøre lokalt

Siden bruker ES-moduler og `fetch`, så den må serveres over HTTP. Å dobbeltklikke `index.html` virker ikke.

```
python -m http.server 8000 -d docs
```

Åpne `http://localhost:8000`.

## Oppdatere data

Kildefilene legges i `build/input/` (se `LES_MEG.txt` der). Skriptene skriver til `docs/data/`
og oppdaterer `meta.json`. Koden rører du ikke: årstall, totaler og antall i grensesnittet hentes fra `meta.json`.

Første gang:

```
pip install -r build/requirements.txt
cd build && npm install && cd ..
```

**Ny årgang befolkning** (typisk én gang i året):

```
python build/prep_ruter.py                     # nyeste år i input/ mot fem år før
python build/prep_ruter.py --fra 2020 --til 2026   # eller velg årene selv
```

**Ny grunnkretsinndeling** (når Geonorge publiserer, som regel fra 1. januar):

```
python build/prep_grenser.py 2027
```

**Navn fra Klass** (samme år som grensene):

```
python build/prep_navn.py 2027 --kommuner klass_131.csv --fylker klass_104.csv --grunnkretser klass_1.csv
```

Hvert skript skriver en kontrollrapport og **stopper uten å endre filer** hvis en kontroll feiler:
duplikate ID-er, ruter utenfor Norge, verdier som ikke får plass i formatet, kommunenumre som mangler
i navnetabellen og lignende. Store avvik mot forrige bygg gir en advarsel. Les rapporten før du committer.

Befolkning og grenser kan oppdateres hver for seg. Rutenettet er stabilt over tid, og kartet summerer
ikke ruter opp til grunnkretser, så det finnes ingen årgangskobling mellom dem.

## Valg og forbehold

- **Sammenligningsår.** Standard er et rullerende femårsvindu (`--fra` = `--til` − 5). Et fast basisår velges med `--fra`.
- **Høyde** er kvadratroten av bosatte per km². Skalaen justeres per rutestørrelse (`BASE` i `config.js`).
- **Endring i prosent** vises bare der ruta hadde minst 20 bosatte i fra-året (`MIN_BASE_PST`).
- **250 m-ruter** vises i en radius på 22 km rundt kartmidten (`R250`).
- **Nye og tømte ruter** er ikke bare flytting. Nybygg, riving og endrede adressepunkter slår også ut.
- **Navn.** `navn.json` er foreløpig laget fra Kartverkets 2024-grenser (via robhop/fylker-og-kommuner) og mangler delområdenavn. Kjør `prep_navn.py` med Klass-filer for å erstatte den.
- **`prep_navn.py` er ikke testet mot en faktisk Klass-eksport.** Skriptet leter etter kolonnene code/kode, name/navn og level/nivå og stopper med en melding hvis de ikke finnes.
- **Ikke verifisert i nettleser av utvikleren**: søyler på 3D-terreng, ytelse ved skifte til 1 km-nivå, og fontnavnene fra OpenFreeMap.

## Kilder og lisenser

| Data | Kilde | Lisens |
|---|---|---|
| Befolkning på rutenett 250 m | SSB | NLOD |
| Grunnkretser | Kartverket/SSB via Geonorge | se Geonorge |
| Kommune- og fylkesnavn (midlertidig) | Kartverket via robhop/fylker-og-kommuner | CC BY 4.0 |
| Bakgrunnskart | OpenFreeMap, OpenMapTiles, © OpenStreetMap-bidragsytere | ODbL |
| Terreng | Mapterhorn | se mapterhorn.com/attribution |
