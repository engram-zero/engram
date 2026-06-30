// ─── Engram texture system (drop-in PNGs, multiple variants, graceful fallback) ─
//
// FOR THE ARTIST:
//   1. Drop your PNGs into `public/textures/`.
//   2. Add the filename(s) to the matching slot array below. You can list SEVERAL
//      variants per slot (e.g. madera1/2/3) — the scene spreads them across the
//      houses/trees so the world doesn't look repetitive.
//   3. A slot with an empty array → the generic flat-color fallback (nothing breaks).
//
// IMPORTANT: only list files that you've actually added. A name with no file will
// show a broken texture (not a fallback). Adding/removing a name is a one-line edit.
//
// Specs: tileable, 512×512, < ~80 KB each. See docs/ART_ASSETS.md for the full list.

import * as THREE from 'three';

export type TextureSlot =
  | 'terrain_grass'
  | 'terrain_sand'
  | 'terrain_snow'
  | 'terrain_dry'
  | 'cottage_wood'
  | 'cottage_roof'
  | 'stone'
  | 'bark'
  | 'foliage_pine'
  | 'foliage_broadleaf'
  | 'foliage_bush';

/**
 * Each slot maps to an ARRAY of filenames in `public/textures/` (the variants).
 * Fill these in as you add PNGs. Recommended filenames are shown in comments —
 * use them (or any names you like) and the scene picks them up.
 */
export const TEXTURE_MANIFEST: Record<TextureSlot, string[]> = {
  terrain_grass: ['pasto1.webp', 'pasto2.webp'],
  terrain_sand: ['arena1.webp', 'arena2.webp'],
  terrain_snow: ['nieve1.webp', 'nieve2.webp', 'nieve3.webp'],
  terrain_dry: ['seco1.webp', 'seco2.webp'],
  cottage_wood: ['madera1.webp', 'madera2.webp', 'madera3.webp'],
  cottage_roof: ['tejado1.webp', 'tejado2.webp', 'tejado3.webp'],
  stone: ['piedra1.webp', 'piedra2.webp', 'piedra3.webp'],
  bark: ['corteza1.webp', 'corteza2.webp', 'corteza3.webp'],
  foliage_pine: ['pino1.webp', 'pino2.webp', 'pino3.webp'],
  foliage_broadleaf: ['follaje1.webp', 'follaje2.webp', 'follaje3.webp'],
  foliage_bush: ['arbusto1.webp', 'arbusto2.webp'],
};

const cache = new Map<string, THREE.Texture>();

export interface TextureOpts {
  /** Tiling repeat (uses RepeatWrapping). Omit for no tiling. */
  repeat?: number;
}

function load(file: string, opts: TextureOpts): THREE.Texture {
  const key = `${file}|${opts.repeat ?? 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const tex = new THREE.TextureLoader().load(
    `/textures/${file}`,
    undefined,
    undefined,
    () => console.warn(`[engram] texture "${file}" failed to load`)
  );
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (opts.repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(opts.repeat, opts.repeat);
  }
  cache.set(key, tex);
  return tex;
}

/** How many variant PNGs are registered for a slot. */
export function variantCount(slot: TextureSlot): number {
  return TEXTURE_MANIFEST[slot].length;
}

/**
 * Returns the texture for a slot, choosing variant `seed % count` so each object
 * (house, tree group) gets a stable variant. Returns `null` when no PNG is
 * registered → caller keeps its flat color. Safe to call every render (cached).
 */
export function getTextureVariant(slot: TextureSlot, seed: number, opts: TextureOpts = {}): THREE.Texture | null {
  if (typeof window === 'undefined') return null; // SSR guard
  const files = TEXTURE_MANIFEST[slot];
  if (files.length === 0) return null;
  const file = files[((seed % files.length) + files.length) % files.length];
  return load(file, opts);
}

/** Convenience: first/only variant of a slot (for single surfaces like the terrain). */
export function getTexture(slot: TextureSlot, opts: TextureOpts = {}): THREE.Texture | null {
  return getTextureVariant(slot, 0, opts);
}

/** True if at least one PNG is registered for this slot. */
export function hasTexture(slot: TextureSlot): boolean {
  return variantCount(slot) > 0;
}
