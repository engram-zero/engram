// ─── Engram texture system (drop-in PNGs with graceful fallback) ──────────────
//
// FOR THE ARTIST: drop your PNGs into `public/textures/` and add their filenames
// to TEXTURE_MANIFEST below. The scene then uses them automatically. If a texture
// is NOT in the manifest (or you delete the PNG), the scene falls back to the
// existing generic flat-shaded look — nothing breaks. You can iterate one texture
// at a time.
//
// Recommended PNGs: tileable, 512×512, < ~80 KB each (PNG or WebP). See the list
// in docs/ART_ASSETS.md.

import * as THREE from 'three';

/**
 * Filenames present in `public/textures/`. Flip an entry to `true` (or add a new
 * one) when the PNG exists. Anything not listed → generic fallback (flat color).
 *
 * Keys are the canonical texture slots the scene asks for. You can also point a
 * slot at any filename you like by changing the value to that filename string.
 */
export const TEXTURE_MANIFEST: Record<TextureSlot, string | false> = {
  terrain_grass: false, // ground
  cottage_wood: false, // house walls
  cottage_roof: false, // house roof
  stone: false, // plinth / chimney
  bark: false, // tree trunks
  foliage_pine: false, // pine canopy
  foliage_broadleaf: false, // broadleaf canopy
  foliage_bush: false, // bushes
};

export type TextureSlot =
  | 'terrain_grass'
  | 'cottage_wood'
  | 'cottage_roof'
  | 'stone'
  | 'bark'
  | 'foliage_pine'
  | 'foliage_broadleaf'
  | 'foliage_bush';

const cache = new Map<string, THREE.Texture>();

export interface TextureOpts {
  /** Tiling repeat (uses RepeatWrapping). Omit for no tiling. */
  repeat?: number;
}

/**
 * Returns a loaded THREE.Texture for the given slot, or `null` if no PNG is
 * registered for it (caller should then keep its flat color). Safe to call every
 * render — textures are cached and load asynchronously without blocking.
 */
export function getTexture(slot: TextureSlot, opts: TextureOpts = {}): THREE.Texture | null {
  if (typeof window === 'undefined') return null; // SSR guard
  const file = TEXTURE_MANIFEST[slot];
  if (!file) return null;

  const key = `${file}|${opts.repeat ?? 0}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const tex = new THREE.TextureLoader().load(
    `/textures/${file}`,
    undefined,
    undefined,
    () => console.warn(`[engram] texture "${file}" failed to load — using fallback`)
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

/** True if a real PNG is registered for this slot (handy for toggling flatShading). */
export function hasTexture(slot: TextureSlot): boolean {
  return !!TEXTURE_MANIFEST[slot];
}
