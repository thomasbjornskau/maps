// Faste valg: murhøyder og -bredder, farger, temaer og kamera.
export const KOMMUNE = 1, FYLKE = 2, RIKE = 3;

// Murhøyde i meter ved ulike zoomnivåer (før typefaktor og brukerens forsterkning)
export const HEIGHT_STOPS = [[4, 14000], [6, 6000], [8, 2200], [10, 840], [12, 320], [14, 120]];
export const TYPE_FACTOR = { [KOMMUNE]: 1, [FYLKE]: 1.9, [RIKE]: 2.4 };
export const GHOST = 0.14;          // høyde (andel) for grenser som forsvant i år

// Murbredde i skjermpiksler. Bredden i meter regnes ut fra zoom og breddegrad,
// og murene bygges på nytt når zoomnivået (heltall) eller breddegraden endrer seg merkbart.
export const WALL_PX = 1.4;
const M_PER_PX_Z0 = 40075016.686 / 512;           // MapLibre bruker 512-pikslers fliser
export function halfWidthFor(z, lat) {
  const zMid = Math.floor(z) + 0.5;                 // midt i heltallsintervallet
  const mpp = M_PER_PX_Z0 * Math.cos(lat * Math.PI / 180) / 2 ** zMid;
  return Math.max(2, mpp * WALL_PX / 2);
}
export const widthKey = (z, lat) => `${Math.floor(z)}|${Math.round(lat / 4)}`;

export const THEME = {
  dag: {
    land: '#dfe6d3', wood: '#d2ddc4', ice: '#f3f6f4', water: '#6fa5aa', shadow: '#4f6357', hi: '#ffffff', hsEx: .45,
    sky: { 'sky-color': '#b9d0d4', 'horizon-color': '#e4ebe2', 'fog-color': '#dfe6dc', 'sky-horizon-blend': .6, 'horizon-fog-blend': .6, 'fog-ground-blend': .5, 'atmosphere-blend': 0 },
    light: { anchor: 'viewport', color: '#ffffff', intensity: .38, position: [1.2, 210, 40] },
    wall: { [KOMMUNE]: '#2c6e66', [FYLKE]: '#1d3f5c', [RIKE]: '#6b3d2e' }, ny: '#e08a1e', borte: '#b0532a', op: .9,
    tint: '#e08a1e', hover: '#1f3d3a', sel: '#1d3f5c', lab: '#1f3d3a', halo: 'rgba(255,255,255,.9)'
  },
  kveld: {
    land: '#e4d5bf', wood: '#d9c9ae', ice: '#f4ebdf', water: '#5c7f95', shadow: '#5a4252', hi: '#ffe6c8', hsEx: .55,
    sky: { 'sky-color': '#dba27c', 'horizon-color': '#f4d2ad', 'fog-color': '#e9cdb0', 'sky-horizon-blend': .7, 'horizon-fog-blend': .65, 'fog-ground-blend': .5, 'atmosphere-blend': 0 },
    light: { anchor: 'viewport', color: '#ffcf9a', intensity: .5, position: [1.2, 265, 72] },
    wall: { [KOMMUNE]: '#8a4f3c', [FYLKE]: '#4b2a55', [RIKE]: '#3b2a2a' }, ny: '#f0b14a', borte: '#c0392b', op: .9,
    tint: '#9a4f3c', hover: '#3b2a2a', sel: '#4b2a55', lab: '#3b2a2a', halo: 'rgba(255,240,225,.9)'
  },
  natt: {
    land: '#1a2332', wood: '#19222f', ice: '#283247', water: '#0d1421', shadow: '#03060c', hi: '#34405a', hsEx: .5,
    sky: { 'sky-color': '#070c1a', 'horizon-color': '#1a2440', 'fog-color': '#111a2b', 'sky-horizon-blend': .6, 'horizon-fog-blend': .6, 'fog-ground-blend': .55, 'atmosphere-blend': 0 },
    light: { anchor: 'viewport', color: '#9fb0ff', intensity: .3, position: [1.2, 210, 40] },
    wall: { [KOMMUNE]: '#7fd6e6', [FYLKE]: '#ffd36b', [RIKE]: '#ff8fa3' }, ny: '#ffffff', borte: '#ff4d6d', op: .9,
    tint: '#ffd36b', hover: '#ffffff', sel: '#7fd6e6', lab: '#e8ecf7', halo: 'rgba(8,12,24,.9)'
  }
};

export const HOME = { center: [13.2, 63.6], zoom: 4.35, pitch: 52, bearing: -8 };
