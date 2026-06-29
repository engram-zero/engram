# Engram — Known issues & past fixes

A running log of bugs we hit, how they were diagnosed, and the fix — so a recurring
symptom can be matched to a known cause instead of re-debugged from scratch.

## Resolved

### Giant overlapping label text under the aerial camera ("stray letters", e.g. "G1H17")
- **Symptom:** when claiming/viewing land parcels in aerial, cell labels render as huge
  overlapping glyphs filling the screen.
- **Cause:** drei `<Html distanceFactor={…}>` scales the HTML by camera distance. Under the
  **orthographic** aerial camera that distance is large/fixed, so the labels blow up.
  (Same family as an earlier bug where a 3D `<Text>`/`<Html>` orphaned in the persistent
  canvas across the title→game transition.)
- **Fix:** drop `distanceFactor` on parcel/ghost labels so `<Html>` renders at a fixed
  screen size. (29 jun 2026, `Scene3D.tsx` parcel ghost + claim labels.)

### Gathering swing "vibrates like a hummingbird" + no hit sound while holding F
- **Cause:** the hold-to-gather `setInterval` effect listed `publicWorld.parcels` + unmemoized
  callbacks in its deps, so it tore down/recreated every render (≈80ms via `setChopPct`),
  resetting the swing timer → strikes every ~80–160ms; `play()` rewinds the clip each call,
  so the rapid restarts were silent (taps worked, holding didn't).
- **Fix:** move live values behind a ref; effect deps = `[fpExploring]` only.

### Gathering animation / "Hold F" only works from a certain angle
- **Cause:** harvest target required you to *face* the resource (dot-product gate), so a tree
  you weren't looking at dead-on wasn't selectable.
- **Fix:** a lone reachable resource is always selectable; facing only disambiguates a tree
  vs a rock when both are in reach.

### Spark/chip particles only visible from some angles
- **Cause:** the `<points>` object was frustum-culled because its bounding sphere stays at the
  geometry origin, not where the live particles are; when the emitter left the frustum the
  whole system vanished. Also depth-tested against the scene (occluded by the tree/rock).
- **Fix:** `frustumCulled={false}` + `depthTest={false}` + high `renderOrder` on the points.

### Production looked washed-out / no night
- **Cause:** a "bright daylight everywhere" flag overrode the day/night cycle in prod.
- **Fix:** cinematic day/night is the default again (brightened ~25%, visible daytime sun);
  `?day=1` opts into flat bright, `?shot` keeps pinned thumbnail time.

### Walking through other players' buildings
- **Cause:** `resolveCollision` only collided your own `getWorld().buildings`, not the public
  ones discovered from other wallets.
- **Fix:** also collide `getPublicWorldSnapshot().buildings`.

## Open / to investigate

- **Stale Vercel deploy / cached chunks:** after a deploy, the browser can serve old JS/CSS
  (seen as a `*.css` 404 and "fixes not applied"). Always hard-refresh (Ctrl+Shift+R) when
  verifying prod; confirm Vercel deployed the latest `main` commit.
- **"Hold F to mine" hint can linger** when a rock is within `MINE_RANGE` (2.8) but off-screen
  — looks stuck though it's technically in range. Consider clearing the hint more eagerly.
- **Resources not persisting if you close quickly:** gathering updates the local world draft;
  it reaches 0G on **Save World** (aerial) or a memory save. Without that, a reload from the
  0G bundle can look like lost progress. (Candidate fix: debounced autosave after gathering.)
- **Mobile aerial pinch-zoom:** wheel-zoom is desktop-only; touch has no zoom yet.
- **Voxel per-block HP** (e.g. an AI-built torch): each block has its own HP, so damage rings
  stacked into a cluster of circles (ring now suppressed for blocks). Whole-vs-per-block HP is
  still an open design choice (hybrid: group a structure under one HP).
