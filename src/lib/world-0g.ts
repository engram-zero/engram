'use client';

import type { NetworkType } from '@/app/providers';
import { debugInfo, debugWarn } from '@/lib/debug-log';
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

        const remote = normalizeWorldState(bundle.world);
        // Prefer whichever was mutated more recently: a newer LOCAL draft (e.g. wood
        // gathered after the last "Save World") must not be clobbered by a stale 0G
        // snapshot — and a newer 0G snapshot (saved on another device) wins on a fresh
        // browser. No autosave / extra signature needed.
        const chosen = (fallback.savedAt ?? 0) > (remote.savedAt ?? 0) ? fallback : remote;
        await localWorldPersistence.save(wallet, chosen);
        return chosen;
      } catch (error) {
        debugWarn('[engram] world load from 0G failed:', error);
        return fallback;
      }
    },

    async save(wallet, state) {
      const world = normalizeWorldState(state);
      await localWorldPersistence.save(wallet, world);
      debugInfo('[engram] world draft saved locally', {
        wallet,
        buildings: world.buildings.length,
      });
    },
  };
}
