'use client';

import type { NetworkType } from '@/app/providers';
import { readBundle } from '@/lib/memory';
import {
  localWorldPersistence,
  normalizeWorldState,
  type WorldPersistence,
} from '@/lib/world';

/**
 * World persistence backed by the same 0G MemoryBundle root as NPC memory.
 *
 * Loading is truly cross-device: registry -> rootHash -> MemoryBundle.world.
 * Saving gameplay actions stays local immediately; the next conversation save
 * commits the latest WorldState into the bundle in `writeMemory`. This preserves
 * the "no extra MetaMask prompt per chop" UX while still making the world portable
 * once the player performs the normal Engram save.
 */
export function createBundleWorldPersistence(networkType: NetworkType): WorldPersistence {
  return {
    async load(wallet) {
      const fallback = await localWorldPersistence.load(wallet);

      try {
        const bundle = await readBundle(wallet, networkType);
        if (!bundle?.world) return fallback;

        const world = normalizeWorldState(bundle.world);
        await localWorldPersistence.save(wallet, world);
        return world;
      } catch (error) {
        console.warn('[engram] world load from 0G failed:', error);
        return fallback;
      }
    },

    async save(wallet, state) {
      await localWorldPersistence.save(wallet, normalizeWorldState(state));
    },
  };
}
