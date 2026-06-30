import type { BiomeId } from '@/lib/types';

export const BIOME_GROUND: Record<BiomeId, string> = {
  meadow: 'terrain_grass',
  sand: 'terrain_sand',
  snow: 'terrain_snow',
  dry: 'terrain_dry',
};

const BIOME_CENTERS: Record<Exclude<BiomeId, 'meadow'>, { x: number; z: number; radius: number }> = {
  // Rare biomes are deliberately far apart so the terrain reads as broad regions.
  snow: { x: -128, z: -116, radius: 118 },
  sand: { x: 138, z: 122, radius: 126 },
  dry: { x: 124, z: -112, radius: 104 },
};

function hash2(ix: number, iz: number): number {
  let n = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ 0x5bf03635;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function valueNoise(x: number, z: number, scale: number): number {
  const gx = x / scale;
  const gz = z / scale;
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const fx = smoothstep(gx - ix);
  const fz = smoothstep(gz - iz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  const ab = a + (b - a) * fx;
  const cd = c + (d - c) * fx;
  return ab + (cd - ab) * fz;
}

function biomeScore(biome: Exclude<BiomeId, 'meadow'>, x: number, z: number): number {
  const center = BIOME_CENTERS[biome];
  const distance = Math.hypot(x - center.x, z - center.z);
  const regionalNoise = (valueNoise(x + center.x * 0.37, z + center.z * 0.37, 95) - 0.5) * 0.22;
  return 1 - distance / center.radius + regionalNoise;
}

export function biomeBlendAt(x: number, z: number): { primary: BiomeId; secondary: BiomeId; t: number } {
  const scores = [
    { biome: 'meadow', score: 0.34 + (valueNoise(x, z, 180) - 0.5) * 0.08 },
    { biome: 'snow', score: biomeScore('snow', x, z) },
    { biome: 'sand', score: biomeScore('sand', x, z) },
    { biome: 'dry', score: biomeScore('dry', x, z) },
  ] satisfies Array<{ biome: BiomeId; score: number }>;
  scores.sort((a, b) => b.score - a.score);

  const [first, second] = scores;
  const gap = first.score - second.score;
  // t is meaningful near borders: 0 = pure primary, 1 = close to halfway.
  const t = Math.max(0, Math.min(1, 1 - gap / 0.24));
  return { primary: first.biome, secondary: second.biome, t: Math.round(t * 1000) / 1000 };
}

export function biomeAt(x: number, z: number): BiomeId {
  return biomeBlendAt(x, z).primary;
}
