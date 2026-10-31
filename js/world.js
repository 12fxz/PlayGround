/* ============================================================
   ROOMS — палитры и процедурная генерация комнат
   ============================================================ */
import { mulberry32 } from './art.js';

export const PALETTES = [
  { // мокрая зелень
    wall: [92, 102, 82], floor: [43, 48, 38], ceil: [25, 30, 24],
    trim: [122, 136, 104], door: [72, 62, 48], metal: [78, 82, 70],
    light: [255, 205, 121], fog: [7, 10, 8]
  },
  { // ржавый бетон
    wall: [108, 88, 66], floor: [50, 41, 32], ceil: [30, 26, 21],
    trim: [142, 110, 75], door: [67, 52, 39], metal: [82, 74, 61],
    light: [255, 191, 102], fog: [11, 8, 6]
  },
  { // холодный кафель
    wall: [78, 91, 94], floor: [38, 46, 47], ceil: [22, 28, 30],
    trim: [110, 128, 132], door: [52, 62, 65], metal: [86, 97, 100],
    light: [198, 225, 255], fog: [5, 8, 10]
  },
  { // больничный
    wall: [93, 99, 65], floor: [45, 47, 32], ceil: [27, 29, 20],
    trim: [128, 136, 87], door: [68, 62, 45], metal: [85, 89, 71],
    light: [255, 232, 145], fog: [8, 10, 6]
  },
  { // сырой камень
    wall: [82, 85, 76], floor: [39, 42, 37], ceil: [23, 26, 22],
    trim: [112, 118, 103], door: [64, 56, 45], metal: [73, 77, 67],
    light: [255, 211, 138], fog: [7, 8, 7]
  }
];

export function hash32(n) {
  let x = (n | 0) ^ 0x9E3779B9;
  x = Math.imul(x ^ (x >>> 16), 0x85EBCA6B);
  x = Math.imul(x ^ (x >>> 13), 0xC2B2AE35);
  return (x ^ (x >>> 16)) >>> 0;
}

export function worldHash(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function makeRoom(n) {
  const seed = hash32(n * 7919 + 13);
  const rng = mulberry32(seed);
  const palette = PALETTES[Math.floor(rng() * PALETTES.length) % PALETTES.length];

  const side = rng() < 0.5 ? -1 : 1;
  const lockers = [{
    side,
    z: 2.05 + rng() * 0.55,
    usable: true,
    variant: Math.floor(rng() * 3)
  }];
  if (rng() < 0.4) {
    lockers.push({
      side: -side,
      z: 3.55 + rng() * 1.25,
      usable: rng() < 0.25,
      variant: Math.floor(rng() * 3)
    });
  }

  const crates = [];
  if (rng() < 0.58) crates.push({ x: (rng() < 0.5 ? -1 : 1) * (1.45 + rng() * 0.45), z: 4.25 + rng() * 0.65, variant: Math.floor(rng() * 4) });
  if (rng() < 0.28) crates.push({ x: (rng() < 0.5 ? -1 : 1) * (1.55 + rng() * 0.35), z: 4.9 + rng() * 0.55, variant: Math.floor(rng() * 4) });

  return {
    n,
    seed,
    palette,
    lockers,
    crates,
    lamp: {
      x: (rng() - 0.5) * 0.9,
      z: 2.6 + rng() * 1.2,
      phase: rng() * 100,
      broken: rng() < 0.22
    },
    battery: n > 3 && rng() < 0.05,
    batterySpot: { x: (rng() - 0.5) * 2.2, z: 3.15 + rng() * 1.4 },
    grime: Math.floor(rng() * 10000),
    wallVariant: Math.floor(rng() * 3),
    doorNumber: Math.min(300, n + 1),
    poster: rng() < 0.3
  };
}

export function roomDistance(n) {
  return Math.max(0, Math.min(1, n / 300));
}

export const ROOM = {
  halfW: 2.62,
  zMin: -1.15,
  zMax: 6.0,
  height: 3.0,
  eye: 1.64,
  doorHalf: 0.82,
  doorH: 2.38
};
