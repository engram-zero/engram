# Engram Audio Assets

Place audio files under `public/audio/...`. The code is already wired with safe
fallbacks: if a file is missing, the game keeps working and that cue stays silent.

## Required first pass

- `public/audio/ambient/night-crickets-loop.mp3`
  Night ambience loop.
- `public/audio/ambient/campfire-crackle-loop.mp3`
  Fire crackle loop for the village campfire.
- `public/audio/foley/footstep-grass-01.mp3`
- `public/audio/foley/footstep-grass-02.mp3`
- `public/audio/foley/footstep-grass-03.mp3`
- `public/audio/foley/footstep-grass-04.mp3`
  Alternating footstep variations for walking on grass/dirt.

## Already wired optional cues

- `public/audio/foley/jump-takeoff.mp3`
- `public/audio/foley/land-dirt.mp3`
- `public/audio/foley/axe-chop-hit.mp3`
- `public/audio/sfx/attack-swing.mp3`
- `public/audio/ui/dialogue-open.mp3`
- `public/audio/ui/dialogue-close.mp3`
- `public/audio/ui/save-success.mp3`
- `public/audio/ui/save-error.mp3`

## Notes

- Format can be `.mp3`, but if you prefer `.wav` or `.ogg`, update the paths in
  [src/lib/audio/manifest.ts](/d:/projects/hackathon/engram/src/lib/audio/manifest.ts).
- Loops should be trimmed cleanly to avoid clicks.
- Footsteps feel better when they are short, dry, and slightly different from one another.
- Keep files lightweight for web delivery.
