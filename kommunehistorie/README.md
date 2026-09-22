# Norges kommuner 1986–2026

Et 3D-kart over kommuneinndelingen 1. januar hvert år fra 1986 til 2026. Årsvelgeren og et
fylkesfilter ligger øverst i panelet til venstre, og en tidslinje med avspilling ligger nederst.
Kommune-, fylkes- og riksgrenser har hver sin farge og tykkelse. Nye grenser er blå og grenser som
forsvant er røde det året endringen skjedde. Panelet viser hva som endret seg, og slektslinjen
bakover og fremover for kommunen du klikker på.

Søsterkart til befolkningskartet og Stokkøya-kartet.

## Struktur

```
docs/                      ← nettsiden (GitHub Pages publiserer denne mappen)
├── index.html, style.css
├── js/
│   ├── main.js            oppstart, årsvalg, fylkesfilter, valg av kommune
│   ├── lib.js             MapLibre og topojson-client (versjoner pinnes her)
│   ├── config.js          strektykkelser, farger, temaer, fylkesnavn
│   ├── state.js           brukerens valg ↔ URL
│   ├── data.js            atomflater, grenselinjer, fylkesfilter, navnepunkter, punkt-i-polygon
│   ├── history.js         navn per år, beskrivelse av endringer, slektslinjer
│   ├── style.js           kartstil og uttrykk for grenselinjene
│   └── ui.js              historikkpanel, tegnforklaring, tidslinje
└── data/
    ├── meta.json
    ├── atomer.topo.json   all geometri for alle år (TopoJSON)
    └── historikk.json     tilstander, navn, hendelser, navnepunkter, grensestykker

build/                     ← byggeskript, publiseres ikke
├── prep_kommuner.py       kjører alt
├── states.py              kommunetilstander 1986–2026
├── atoms.py               atomer: flater som aldri deles av en grense
├── walls.py               grensestykker, navn, hendelser, navnepunkter
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
slik at bare den nye indre grensen kommer fra Kartverket. Da flytter ikke uendrede grenser seg i 2020.

Kartverket har ikke årganger for 2022 og 2023. Overføringer mellom 2021- og 2024-fila dateres fra
`build/kjente_aar.json` (merknader i Klass). Resten legges i 2024 og merkes «mellom 2022 og 2024».

**Atomer.** Landet deles i de minste flatene som aldri krysses av en kommunegrense i noe år
(512 stykker). Hvert atom har én kode per år. En grense går der to naboatomer har ulik kode.
Hvert grensestykke lagres én gang, med årene det er kommune-, fylkes- eller riksgrense.

**Grenselinjene** klippes mot en grov kystlinje (Natural Earth 1:10 mill., bufret 1 km), slik at de
vises på land. Farger og tykkelser ligger i `config.js`. Kommune, fylke og rike har hver sin farge
(grønn, lilla, nesten svart); blått og rødt er holdt av til nye og forsvunne grenser. Paletten bygger på
Okabe–Ito, slik at typene skilles også ved nedsatt fargesyn, og tykkelsen skiller dem i tillegg.

**Fylkesfilteret** zoomer til fylket og dekker resten av landet. Det følger et punkt i fylket, slik at
filteret overlever fylkessammenslåinger: velger du Hordaland i 2019 og blar til 2020, viser kartet Vestland.

**Historikken** bygger på endringstabellen i Klass og går tilbake til 1838, selv om grensene starter
i 1986. Utgangsnavnene kommer fra kommunefila for 1838 (kart.ssb.no), og byggeskriptet sjekker at
kjeden av Klass-endringer fra 1838 ender nøyaktig i SSBs 1986-kommuner. Slektslinjen følger kommuner
som gikk opp i den valgte, men ikke naboer som bare avga areal og selv fortsatte. Arealoverføringer uten kodeendring (f.eks.
Alstahaug → Vefsn 1995, Rauma → Vestnes 2021) er funnet ved å sammenligne årgangene.

## Forbehold

- **Ikke sett i nettleser av utvikleren.** Stil og uttrykk er validert mot MapLibres
  stilspesifikasjon, og data-, historikk- og filtermodulene er testet i Node, men selve renderingen er ikke sett.
- **Fylkesnavnene** er en tabell i `config.js` over fylkesnumrene 1986–2026, ikke hentet fra Klass.
- **Arealtall** for overføringer inkluderer sjø.
- **Før 1986** vises bare historikken, ikke grensene. Kart.ssb.no har grenser per periode helt fra 1838;
  testfilene for 1958 og 1972 treffer 1986-grensene med 94 % eksakt sammenfall, så serien kan bygges ut bakover.

## Kilder og lisenser

| Data | Kilde | Lisens |
|---|---|---|
| Kommunegrenser 1986–2019 | SSB, historisk kommunestruktur (forbedret) | se ssb.no |
| Kommunegrenser 2019–2026 | Kartverket via Geonorge | CC BY 4.0 |
| Kommuneendringer | SSB, Klass 131 | CC BY 4.0 |
| Kystlinje | Natural Earth | Public domain |
| Bakgrunnskart | OpenFreeMap, OpenMapTiles, © OpenStreetMap-bidragsytere | ODbL |
| Terreng | Mapterhorn | se mapterhorn.com/attribution |
