// Faste valg for kartet: soner, skalaer, fargepaletter, temaer og kamera.

// Rutestørrelse etter zoom (SSBs anbefalte målestokker, tilpasset webkart)
export const LEVELS = [25000, 5000, 1000, 250];
export function autoLevel(z) { return z < 6.6 ? 25000 : z < 9.1 ? 5000 : z < 11.4 ? 1000 : 250; }
export const R250 = 22000;           // radius (m) rundt kartmidten der 250 m-ruter vises

// Søylehøyde: meter per √(bosatte per km²), justert per rutestørrelse
export const BASE = { 25000: 1100, 5000: 160, 1000: 26, 250: 9 };
export const INSET = 0.08;           // innskyting av søylene, andel av rutebredden
export const MIN_BASE_PST = 20;      // minste antall bosatte i fra-året for prosentvis endring

// Zoom der grenselagene begynner å vises
export const ZDO = 7, ZGK = 9;

// Klassegrenser
export const DENS_BR = [10, 50, 200, 1000, 3000, 8000];      // bosatte per km²
export const CHG_BR = [-100, -20, -2, 2, 20, 100, 500];      // endring per km²
export const PST_BR = [-20, -5, -1, 1, 5, 20];               // endring i prosent

export const PAL = {
  dag: {
    dens: ['#dfe9c9', '#b4d8b4', '#7cbca9', '#46999a', '#2a7480', '#1a5068', '#10304a'],
    chg: ['#8c3b1c', '#c8743f', '#e8b88a', '#e7e9df', '#b4dccf', '#6db6a6', '#2f8680', '#12545e'],
    pst: ['#8c3b1c', '#c8743f', '#e8b88a', '#e7e9df', '#9fd1c3', '#4ea497', '#17666a'],
    nyC: '#2d56b8', tomC: '#6e1f10', few: '#b9c1bd', op: .74, hov: '#f4b23c'
  },
  kveld: {
    dens: ['#f7e7bd', '#f4c887', '#eca064', '#dc7650', '#b9504c', '#8a3750', '#5a2549'],
    chg: ['#5b2a6e', '#8a4f8f', '#c79bbd', '#efe4d6', '#f3c98f', '#e79a55', '#c86a2f', '#8f4318'],
    pst: ['#5b2a6e', '#8a4f8f', '#c79bbd', '#efe4d6', '#f0bf82', '#dc8a47', '#a9561f'],
    nyC: '#6b1f12', tomC: '#2e1846', few: '#c9b8ad', op: .76, hov: '#f4b23c'
  },
  natt: {
    dens: ['#39405e', '#5a567a', '#9b7460', '#dca052', '#ffcd63', '#ffeaa0', '#fffbe6'],
    chg: ['#ff4d6d', '#c4476c', '#7b3e60', '#454a68', '#3a7c90', '#3cb3c7', '#72e4f1', '#d2fcff'],
    pst: ['#ff4d6d', '#c4476c', '#7b3e60', '#454a68', '#3cb3c7', '#72e4f1', '#d2fcff'],
    nyC: '#9fb8ff', tomC: '#ff2248', few: '#3d4460', op: .88, hov: '#ffffff'
  }
};

export const THEME = {
  dag: {
    land: '#dfe6d3', wood: '#d2ddc4', ice: '#f3f6f4', water: '#6fa5aa', road: '#f6f2e6', roadOp: .85,
    shadow: '#4f6357', hi: '#ffffff', hsEx: .45,
    sky: { 'sky-color': '#b9d0d4', 'horizon-color': '#e4ebe2', 'fog-color': '#dfe6dc', 'sky-horizon-blend': .6, 'horizon-fog-blend': .6, 'fog-ground-blend': .5, 'atmosphere-blend': 0 },
    light: { anchor: 'viewport', color: '#ffffff', intensity: .35, position: [1.2, 210, 40] },
    lab: '#2b4541', halo: 'rgba(255,255,255,.85)', komm: '#2b5d58', fyl: '#1d3f3c', border: '#51605c',
    gkL: '#3d6d68', doL: '#24524d', hl: '#e08a1e'
  },
  kveld: {
    land: '#e4d5bf', wood: '#d9c9ae', ice: '#f4ebdf', water: '#5c7f95', road: '#f2dcbd', roadOp: .8,
    shadow: '#5a4252', hi: '#ffe6c8', hsEx: .55,
    sky: { 'sky-color': '#dba27c', 'horizon-color': '#f4d2ad', 'fog-color': '#e9cdb0', 'sky-horizon-blend': .7, 'horizon-fog-blend': .65, 'fog-ground-blend': .5, 'atmosphere-blend': 0 },
    light: { anchor: 'viewport', color: '#ffcf9a', intensity: .5, position: [1.2, 265, 72] },
    lab: '#3d2a28', halo: 'rgba(255,240,225,.85)', komm: '#6a3e3a', fyl: '#4a2a2a', border: '#6b5250',
    gkL: '#7d544b', doL: '#5a3530', hl: '#6d2f86'
  },
  natt: {
    land: '#1a2332', wood: '#19222f', ice: '#283247', water: '#0d1421', road: '#2a3448', roadOp: .9,
    shadow: '#03060c', hi: '#34405a', hsEx: .5,
    sky: { 'sky-color': '#070c1a', 'horizon-color': '#1a2440', 'fog-color': '#111a2b', 'sky-horizon-blend': .6, 'horizon-fog-blend': .6, 'fog-ground-blend': .55, 'atmosphere-blend': 0 },
    light: { anchor: 'viewport', color: '#9fb0ff', intensity: .22, position: [1.2, 210, 40] },
    lab: '#c9d2ea', halo: 'rgba(8,12,24,.85)', komm: '#8aa0d8', fyl: '#c7d2f5', border: '#6d7896',
    gkL: '#6f84b4', doL: '#aebde8', hl: '#ffffff'
  }
};

export const HOME = { center: [13.2, 63.6], zoom: 4.35, pitch: 48, bearing: -8 };

// [navn, undertekst, senter, zoom, pitch, bearing]
export const PLACES = [
  ['Oslo', 'Hovedstaden og byens tetteste ruter', [10.76, 59.915], 11.2, 60, -20],
  ['Oslofjorden', 'Byer på rad langs fjorden', [10.55, 59.45], 8.6, 58, -10],
  ['Bergen', 'Byen mellom fjellene', [5.33, 60.39], 11, 62, 40],
  ['Stavanger og Jæren', 'Byregion og flatt jordbruksland', [5.72, 58.85], 9.6, 58, -30],
  ['Trondheim', 'Fra Midtbyen til Heimdal', [10.40, 63.42], 10.8, 60, 15],
  ['Kristiansand', 'Sørlandets største by', [7.99, 58.15], 10.8, 58, 0],
  ['Ålesund', 'Øyer og sund på Sunnmøre', [6.25, 62.47], 10.2, 62, -35],
  ['Bodø', 'Byen ved Saltfjorden', [14.40, 67.28], 10.6, 60, 20],
  ['Lofoten', 'Bosetting på en smal stripe mellom fjell og hav', [13.95, 68.15], 8.4, 65, 60],
  ['Tromsø', 'Øybyen i nord', [18.96, 69.66], 10.6, 62, -15],
  ['Finnmarksvidda', 'Kautokeino, Karasjok og store tomrom', [24.3, 69.3], 7.4, 55, 0]
];

export const TOUR = [
  { center: [10.76, 59.915], zoom: 10.4, pitch: 62, bearing: -25, duration: 6500 },
  { center: [10.5, 59.35], zoom: 8.3, pitch: 58, bearing: -5, duration: 6000 },
  { center: [5.72, 58.88], zoom: 9.3, pitch: 60, bearing: -40, duration: 7500 },
  { center: [5.34, 60.39], zoom: 10.4, pitch: 64, bearing: 35, duration: 6500 },
  { center: [10.40, 63.42], zoom: 10.2, pitch: 60, bearing: 10, duration: 8000 },
  { center: [14.4, 67.8], zoom: 7.6, pitch: 62, bearing: 35, duration: 8000 },
  { center: [18.96, 69.66], zoom: 10.2, pitch: 62, bearing: -15, duration: 7000 },
  { ...HOME, duration: 8000 }
];
