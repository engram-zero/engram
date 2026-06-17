// ─── In-memory sliding-window rate limiter (server-only) ──────────────────────
// Cheap abuse/cost defence for the public /api/npc endpoint. Keeps a log of hit
// timestamps per key and enforces several windows at once (per-minute + per-day).
//
// SCOPE: this is per-process memory. On a single warm serverless instance it
// stops a client hammering the endpoint; across many cold instances each keeps
// its own counters, so it's a floor, not a hard global cap. For a strict global
// limit, swap `reserve()` for a Redis/Vercel-KV backed check (e.g.
// @upstash/ratelimit) gated behind UPSTASH_REDIS_REST_URL/TOKEN — the call sites
// below don't change. Documented as the next step; in-memory is enough for the demo.

export interface RateWindow {
  /** Window length in ms. */
  ms: number;
  /** Max hits allowed inside the window. */
  max: number;
}

// Defaults: ~15 messages/minute and ~200/day per key.
export const DEFAULT_WINDOWS: RateWindow[] = [
  { ms: 60_000, max: 15 },
  { ms: 86_400_000, max: 200 },
];

const MAX_WINDOW_MS = Math.max(...DEFAULT_WINDOWS.map((w) => w.ms));

// key → ascending list of hit timestamps (epoch ms), pruned to MAX_WINDOW_MS.
const log = new Map<string, number[]>();

export interface RateResult {
  ok: boolean;
  /** Seconds until the caller may retry (0 when ok). */
  retryAfter: number;
}

function prune(arr: number[], now: number): number[] {
  // Timestamps are appended in order, so drop from the front.
  let i = 0;
  while (i < arr.length && now - arr[i] >= MAX_WINDOW_MS) i++;
  return i > 0 ? arr.slice(i) : arr;
}

// Occasionally sweep keys that have gone quiet so the map can't grow forever.
function maybeSweep(now: number) {
  if (Math.random() > 0.01) return;
  for (const [key, arr] of log) {
    const pruned = prune(arr, now);
    if (pruned.length === 0) log.delete(key);
    else if (pruned !== arr) log.set(key, pruned);
  }
}

/**
 * Checks every key against every window WITHOUT recording, returning the worst
 * retry-after if any is over its limit. Only when all keys pass does it record a
 * hit on each — so a blocked request doesn't consume any key's budget.
 */
export function reserve(keys: string[], windows: RateWindow[] = DEFAULT_WINDOWS): RateResult {
  const now = Date.now();
  maybeSweep(now);

  let worstRetry = 0;
  const pruned: Record<string, number[]> = {};

  for (const key of keys) {
    const arr = prune(log.get(key) ?? [], now);
    pruned[key] = arr;
    for (const w of windows) {
      let count = 0;
      let oldestInWindow = now;
      for (let i = arr.length - 1; i >= 0; i--) {
        if (now - arr[i] < w.ms) {
          count++;
          oldestInWindow = arr[i];
        } else break; // older entries are all outside this window
      }
      if (count >= w.max) {
        const retry = Math.ceil((w.ms - (now - oldestInWindow)) / 1000);
        worstRetry = Math.max(worstRetry, Math.max(1, retry));
      }
    }
  }

  if (worstRetry > 0) {
    // Persist the pruned arrays so memory stays bounded even while blocking.
    for (const key of keys) log.set(key, pruned[key]);
    return { ok: false, retryAfter: worstRetry };
  }

  // All clear — record the hit on each key.
  for (const key of keys) {
    const arr = pruned[key];
    arr.push(now);
    log.set(key, arr);
  }
  return { ok: true, retryAfter: 0 };
}

/** Test/maintenance helper — clears all counters. */
export function _resetRateLimit() {
  log.clear();
}
