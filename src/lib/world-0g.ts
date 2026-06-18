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
 * Saving gameplay actions here only writes a local draft. The player must click
 * "Save World" in aerial mode to upload the draft world bundle and anchor the
 * root in EngramRegistry. That keeps the blockchain step explicit and testable.
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
      const world = normalizeWorldState(state);
      await localWorldPersistence.save(wallet, world);
      console.info('[engram] world draft saved locally', {
        wallet,
        buildings: world.buildings.length,
      });
    },
  };
}
