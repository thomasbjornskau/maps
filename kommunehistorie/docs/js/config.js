// Faste valg: murhøyder og -bredder, farger, temaer og kamera.
export const KOMMUNE = 1, FYLKE = 2, RIKE = 3;

// Strektykkelse i piksler per zoom, før brukerens forsterkning
export const LINE_WIDTH = {
  [KOMMUNE]: [[4, .5], [7, 1], [10, 1.6], [13, 2.4]],
  [FYLKE]: [[4, 1.3], [7, 2.2], [10, 3.2], [13, 4.2]],
  [RIKE]: [[4, 2.2], [7, 3.4], [10, 4.6], [13, 6]]
};
export const CHANGE_MIN = [[4, 1.6], [7, 2.4], [10, 3.2], [13, 4]];   // nye og forsvunne grenser er minst så tykke

// Fylkesnavn etter fylkesnummer. Numrene er entydige gjennom hele perioden 1986–2026.
export const FYLKER = {
  '01': 'Østfold', '02': 'Akershus', '03': 'Oslo', '04': 'Hedmark', '05': 'Oppland', '06': 'Buskerud',
  '07': 'Vestfold', '08': 'Telemark', '09': 'Aust-Agder', '10': 'Vest-Agder', '11': 'Rogaland',
  '12': 'Hordaland', '14': 'Sogn og Fjordane', '15': 'Møre og Romsdal', '16': 'Sør-Trøndelag',
  '17': 'Nord-Trøndelag', '18': 'Nordland', '19': 'Troms', '20': 'Finnmark', '50': 'Trøndelag',
  '30': 'Viken', '34': 'Innlandet', '38': 'Vestfold og Telemark', '42': 'Agder', '46': 'Vestland',
  '54': 'Troms og Finnmark', '31': 'Østfold', '32': 'Akershus', '33': 'Buskerud', '39': 'Vestfold',
  '40': 'Telemark', '55': 'Troms', '56': 'Finnmark'
};

export const THEME = {
  dag: {
    land: '#dfe6d3', wood: '#d2ddc4', ice: '#f3f6f4', water: '#6fa5aa', shadow: '#4f6357', hi: '#ffffff', hsEx: .45,
    sky: { 'sky-color': '#b9d0d4', 'horizon-color': '#e4ebe2', 'fog-color': '#dfe6dc', 'sky-horizon-blend': .6, 'horizon-fog-blend': .6, 'fog-ground-blend': .5, 'atmosphere-blend': 0 },
    light: { anchor: 'viewport', color: '#ffffff', intensity: .38, position: [1.2, 210, 40] },
    line: { [KOMMUNE]: '#1f7a5c', [FYLKE]: '#a8327d', [RIKE]: '#1c1c1c' }, ny: '#0a5bd3', borte: '#e0341a', halo: 'rgba(255,255,255,.75)',
    tint: '#ffcc00', tintOp: .5, mask: '#e9ede4', hover: '#1f3d3a', sel: '#1d3f5c', lab: '#1f3d3a', halo: 'rgba(255,255,255,.9)'
  },
  kveld: {
    land: '#e4d5bf', wood: '#d9c9ae', ice: '#f4ebdf', water: '#5c7f95', shadow: '#5a4252', hi: '#ffe6c8', hsEx: .55,
    sky: { 'sky-color': '#dba27c', 'horizon-color': '#f4d2ad', 'fog-color': '#e9cdb0', 'sky-horizon-blend': .7, 'horizon-fog-blend': .65, 'fog-ground-blend': .5, 'atmosphere-blend': 0 },
    light: { anchor: 'viewport', color: '#ffcf9a', intensity: .5, position: [1.2, 265, 72] },
    line: { [KOMMUNE]: '#1f6e55', [FYLKE]: '#8e2a6c', [RIKE]: '#241a1a' }, ny: '#0a4fb8', borte: '#d8261a', halo: 'rgba(255,240,225,.75)',
    tint: '#ffc400', tintOp: .5, mask: '#eee2d2', hover: '#3b2a2a', sel: '#4b2a55', lab: '#3b2a2a', halo: 'rgba(255,240,225,.9)'
  },
  natt: {
    land: '#1a2332', wood: '#19222f', ice: '#283247', water: '#0d1421', shadow: '#03060c', hi: '#34405a', hsEx: .5,
    sky: { 'sky-color': '#070c1a', 'horizon-color': '#1a2440', 'fog-color': '#111a2b', 'sky-horizon-blend': .6, 'horizon-fog-blend': .6, 'fog-ground-blend': .55, 'atmosphere-blend': 0 },
    light: { anchor: 'viewport', color: '#9fb0ff', intensity: .3, position: [1.2, 210, 40] },
    line: { [KOMMUNE]: '#4fd1a5', [FYLKE]: '#f08bd0', [RIKE]: '#f2f2f2' }, ny: '#5aa7ff', borte: '#ff5a3c', halo: 'rgba(8,12,24,.7)',
    tint: '#ffd400', tintOp: .38, mask: '#0b111c', hover: '#ffffff', sel: '#7fd6e6', lab: '#e8ecf7', halo: 'rgba(8,12,24,.9)'
  }
};

export const HOME = { center: [13.2, 63.6], zoom: 4.35, pitch: 52, bearing: -8 };
