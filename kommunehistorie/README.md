# Norges kommuner 1986–2026 – grensene som murer

Et 3D-kart der kommunegrensene står som murer. En tidslinje nederst blar gjennom
kommuneinndelingen 1. januar hvert år. Murer vokser fram når grenser oppstår og synker
når kommuner slås sammen. Panelet øverst til venstre viser hva som endret seg hvert år,
og slektslinjen bakover og fremover for kommunen du klikker på.

Søsterkart til befolkningskartet og Stokkøya-kartet.

## Struktur

```
docs/                      ← nettsiden (GitHub Pages publiserer denne mappen)
├── index.html, style.css
├── js/
│   ├── main.js            oppstart, tidslinje, animasjon, valg
│   ├── lib.js             MapLibre og topojson-client (versjoner pinnes her)
│   ├── config.js          murhøyder og -bredder, farger, temaer
│   ├── state.js           brukerens valg ↔ URL
│   ├── data.js            atomflater, murgeometri, navnepunkter, punkt-i-polygon
│   ├── history.js         navn per år, beskrivelse av endringer, slektslinjer
│   ├── style.js           kartstil og uttrykk for murene
│   └── ui.js              historikkpanel, tegnforklaring, tidslinje
└── data/
    ├── meta.json
    ├── atomer.topo.json   all geometri for alle år (TopoJSON)
    └── historikk.json     tilstander, navn, hendelser, navnepunkter, murer

build/                     ← byggeskript, publiseres ikke
├── prep_kommuner.py       kjører alt
├── states.py              kommunetilstander 1986–2026
├── atoms.py               atomer: flater som aldri deles av en grense
├── walls.py               murer, navn, hendelser, navnepunkter
├── kjente_aar.json       årstall for overføringer som bare kan dateres fra Klass-merknader
├── requirements.txt, package.json
└── input/                 kildefiler (se LES_MEG.txt)
```

## Publisering og lokal kjøring

GitHub: *Settings → Pages → Deploy from a branch → `main` / `/docs`*.

Lokalt (moduler og `fetch` krever HTTP):

```
python -m http.server 8000 -d docs
```

## Bygge dataene

```
pip install -r build/requirements.txt
cd build && npm install && cd ..
python build/prep_kommuner.py                   # standard: 75 m forenkling, 1 km landbuffer
python build/prep_kommuner.py --toleranse 50 --landbuffer 500
```

Skriptet stopper uten å skrive filer hvis kontrollene feiler. Det sjekker at kodesettet for
2020–2026 stemmer med Klass, at totalarealet er likt alle år, og at hver tilstand kan
gjenoppbygges fra atomene.

## Metode

**Én geometri for alle år.** 1986–2019 er SSBs historiske kommunestruktur. Den er tilbakeført
fra ABAS grunnkretser 2019, så uendrede grenser er identiske i alle år. 2020–2026 er 2019-grensene
ført videre med Klass-endringene: sammenslåinger blir unioner, omnummereringer får ny kode.

Kartverkets årganger (2019, 2020, 2021, 2024, 2025 og gjeldende) brukes til å finne områder som
skifter kommune uten at Klass-kodene viser det. I 2020 gjelder det 15 delvise overføringer, som
Balestrand → Høyanger og Forsand → Strand. Bitene klippes mot giverkommunen i SSB-geometrien,
slik at bare den nye indre grensen kommer fra Kartverket. Da hopper ingen murer i 2020.

Kartverket har ikke årganger for 2022 og 2023. Overføringer mellom 2021- og 2024-fila dateres fra
`build/kjente_aar.json` (merknader i Klass). Resten legges i 2024 og merkes «mellom 2022 og 2024».

**Atomer.** Landet deles i de minste flatene som aldri krysses av en kommunegrense i noe år
(512 stykker). Hvert atom har én kode per år. En mur står der to naboatomer har ulik kode.
Hvert grensestykke lagres én gang, med årene det er kommune-, fylkes- eller riksgrense.

**Murene** klippes mot en grov kystlinje (Natural Earth 1:10 mill., bufret 1 km), slik at de
står på land. Høyden styres av et flytende år under animasjonen (`wallHeight` i `style.js`).

**Historikken** bygger på endringstabellen i Klass. Arealoverføringer uten kodeendring (f.eks.
Alstahaug → Vefsn 1995, Rauma → Vestnes 2021) er funnet ved å sammenligne årgangene.

## Forbehold

- **Ikke sett i nettleser av utvikleren.** Stil og uttrykk er validert mot MapLibres
  stilspesifikasjon, og data- og historikkmodulene er testet i Node, men selve renderingen er ikke sett.
- **Animasjonen** oppdaterer murhøyden hvert bilde. Med rundt 1 350 murer bør det gå greit, men det er ikke målt.
- **Overføringer under 0,25 km²** (eller smalere enn om lag 100 m) er under kartets oppløsning og tas ikke med, for eksempel Lillehammer → Øyer i 2022.
- **Udaterte endringer** mellom Kartverkets 2021- og 2024-fil ligger i 2024 med merknad, med mindre `kjente_aar.json` sier noe annet.
- **Arealtall** for overføringer inkluderer sjø.
- **Før 1986** finnes ikke digitale grenser i SSB-serien. Grensene for 1954–1970 ville gitt 1960-tallets store reform.

## Kilder og lisenser

| Data | Kilde | Lisens |
|---|---|---|
| Kommunegrenser 1986–2019 | SSB, historisk kommunestruktur (forbedret) | se ssb.no |
| Kommunegrenser 2019–2026 | Kartverket via Geonorge | CC BY 4.0 |
| Kommuneendringer | SSB, Klass 131 | CC BY 4.0 |
| Kystlinje | Natural Earth | Public domain |
| Bakgrunnskart | OpenFreeMap, OpenMapTiles, © OpenStreetMap-bidragsytere | ODbL |
| Terreng | Mapterhorn | se mapterhorn.com/attribution |
