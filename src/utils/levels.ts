import { Level } from '../types';

// Let's define beautiful, symmetric layouts for levels
// Colors: 'red', 'blue', 'green', 'yellow', 'purple', 'orange' or null (empty space)

const R = 'red';
const B = 'blue';
const G = 'green';
const Y = 'yellow';
const P = 'purple';
const O = 'orange';
const _ = null;

const LEVEL_TEMPLATES: { name: string; grid: (string | null)[][]; targetScore: number; maxShots: number }[] = [
  {
    name: "Canyon Sunrise",
    grid: [
      [R, R, B, B, B, B, R, R],
      [_, Y, Y, G, G, Y, Y, _],
      [_, _, R, B, B, R, _, _],
      [_, _, _, Y, Y, _, _, _],
      [_, _, _, _, _, _, _, _],
      [_, _, _, _, _, _, _, _],
      [_, _, _, _, _, _, _, _],
      [_, _, _, _, _, _, _, _],
    ],
    targetScore: 400,
    maxShots: 20
  },
  {
    name: "Emerald Forest",
    grid: [
      [G, G, G, G, G, G, G, G],
      [Y, Y, B, B, B, B, Y, Y],
      [_, G, G, _, _, G, G, _],
      [_, _, Y, G, G, Y, _, _],
      [_, _, _, B, B, _, _, _],
      [_, _, _, _, _, _, _, _],
      [_, _, _, _, _, _, _, _],
      [_, _, _, _, _, _, _, _],
    ],
    targetScore: 600,
    maxShots: 22
  },
  {
    name: "Symmetric Shields",
    grid: [
      [P, R, P, B, B, P, R, P],
      [_, P, R, R, R, R, P, _],
      [_, _, B, P, P, B, _, _],
      [_, _, _, G, G, _, _, _],
      [_, _, _, _, _, _, _, _],
      [_, _, _, _, _, _, _, _],
      [_, _, _, _, _, _, _, _],
      [_, _, _, _, _, _, _, _],
    ],
    targetScore: 800,
    maxShots: 25
  },
  {
    name: "Rainbow Arch",
    grid: [
      [R, R, O, O, Y, Y, G, G],
      [B, B, P, P, R, R, O, O],
      [_, G, G, Y, Y, B, B, _],
      [_, _, P, P, G, G, _, _],
      [_, _, _, R, R, _, _, _],
      [_, _, _, _, _, _, _, _],
      [_, _, _, _, _, _, _, _],
      [_, _, _, _, _, _, _, _],
    ],
    targetScore: 1200,
    maxShots: 25
  },
  {
    name: "Cosmic Helix",
    grid: [
      [P, B, _, _, _, _, B, P],
      [O, _, Y, _, _, Y, _, O],
      [_, G, _, R, R, _, G, _],
      [_, _, P, _, _, P, _, _],
      [_, _, _, B, B, _, _, _],
      [_, _, _, _, _, _, _, _],
      [_, _, _, _, _, _, _, _],
      [_, _, _, _, _, _, _, _],
    ],
    targetScore: 700,
    maxShots: 20
  },
  {
    name: "Citrus Waves",
    grid: [
      [O, Y, O, Y, O, Y, O, Y],
      [_, O, Y, O, Y, O, Y, _],
      [R, _, B, _, _, B, _, R],
      [_, R, _, B, B, _, R, _],
      [_, _, G, G, G, G, _, _],
      [_, _, _, _, _, _, _, _],
      [_, _, _, _, _, _, _, _],
      [_, _, _, _, _, _, _, _],
    ],
    targetScore: 1000,
    maxShots: 26
  },
  {
    name: "Royal Diamond",
    grid: [
      [_, _, _, P, P, _, _, _],
      [_, _, P, B, B, P, _, _],
      [_, P, B, R, R, B, P, _],
      [P, B, R, Y, Y, R, B, P],
      [_, P, B, R, R, B, P, _],
      [_, _, P, B, B, P, _, _],
      [_, _, _, P, P, _, _, _],
      [_, _, _, _, _, _, _, _],
    ],
    targetScore: 1500,
    maxShots: 30
  },
  {
    name: "Vortex of Doom",
    grid: [
      [R, G, B, P, O, Y, R, G],
      [B, _, _, _, _, _, _ , B],
      [P, _, P, O, Y, R, _, P],
      [O, _, _, _, _, _, _, O],
      [G, _, B, G, G, B, _, G],
      [_, _, _, _, _, _, _, _],
      [_, _, _, _, _, _, _, _],
      [_, _, _, _, _, _, _, _],
    ],
    targetScore: 1100,
    maxShots: 25
  },
  {
    name: "Candy Rows",
    grid: [
      [R, R, R, R, R, R, R, R],
      [G, G, G, G, G, G, G, G],
      [B, B, B, B, B, B, B, B],
      [O, O, O, O, O, O, O, O],
      [Y, Y, Y, Y, Y, Y, Y, Y],
      [_, _, _, _, _, _, _, _],
      [_, _, _, _, _, _, _, _],
      [_, _, _, _, _, _, _, _],
    ],
    targetScore: 1800,
    maxShots: 32
  },
  {
    name: "Crown of Light",
    grid: [
      [Y, Y, _, Y, Y, _, Y, Y],
      [R, R, R, R, R, R, R, R],
      [_, B, B, P, P, B, B, _],
      [_, _, O, O, O, O, _, _],
      [_, _, _, G, G, _, _, _],
      [_, _, _, _, _, _, _, _],
      [_, _, _, _, _, _, _, _],
      [_, _, _, _, _, _, _, _],
    ],
    targetScore: 1300,
    maxShots: 25
  },
  {
    name: "Space Invader",
    grid: [
      [B, _, _, B, B, _, _, B],
      [_, B, B, Y, Y, B, B, _],
      [P, B, G, G, G, G, B, P],
      [_, P, B, B, B, B, P, _],
      [_, _, R, O, O, R, _, _],
      [_, _, _, _, _, _, _, _],
      [_, _, _, _, _, _, _, _],
      [_, _, _, _, _, _, _, _],
    ],
    targetScore: 1400,
    maxShots: 26
  },
  {
    name: "Pyramid of Gems",
    grid: [
      [_, _, _, R, R, _, _, _],
      [_, _, B, B, B, B, _, _],
      [_, G, G, G, G, G, G, _],
      [Y, Y, Y, Y, Y, Y, Y, Y],
      [P, P, P, P, P, P, P, P],
      [O, O, O, O, O, O, O, O],
      [_, _, _, _, _, _, _, _],
      [_, _, _, _, _, _, _, _],
    ],
    targetScore: 2200,
    maxShots: 35
  }
];

export function getLevels(): Level[] {
  return LEVEL_TEMPLATES.map((item, idx) => ({
    id: idx + 1,
    name: item.name,
    grid: JSON.parse(JSON.stringify(item.grid)),
    targetScore: item.targetScore,
    maxShots: item.maxShots,
    unlockedAt: idx === 0 ? 0 : idx // simple unlocked index mechanism based on levels completed
  }));
}

// Generates a fully procedural high-level custom layout mapping for levels > 12
export function generateProceduralLevel(id: number): Level {
  const colors = [R, B, G, Y, P, O];
  // select a subset of colors depending on level difficulty
  const numColors = Math.min(3 + Math.floor(id / 5), 6);
  const activeColors = colors.slice(0, numColors);

  const grid: (string | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));

  // Procedural templates (waves, checkerboard, arches)
  const patternType = id % 3;

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 8; c++) {
      if (patternType === 0) {
        // Waves
        if ((r + c) % 2 === 0) {
          grid[r][c] = activeColors[(r + c) % activeColors.length];
        }
      } else if (patternType === 1) {
        // Dense arches
        if (r < 3 || (c > 1 && c < 6)) {
          grid[r][c] = activeColors[(r * 2 + c) % activeColors.length];
        }
      } else {
        // Blocks
        const block = Math.floor(c / 2);
        grid[r][c] = activeColors[(r + block) % activeColors.length];
      }
    }
  }

  return {
    id,
    name: `Nebula Layer ${id}`,
    grid,
    targetScore: 1000 + id * 150,
    maxShots: Math.max(18, 35 - Math.floor(id / 2)),
    unlockedAt: id - 1
  };
}
