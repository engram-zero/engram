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
- `public/audio/foley/mine-hit.mp3` — distinct stony "tink/crack" for mining rocks (Prompt 16).
- `public/audio/foley/footstep-water.mp3` — splash when walking through the creek.
- `public/audio/ambient/day-ambience-loop.mp3` — relaxing daytime bed (birds/air); kept very
  low (`volume: 0.11` in the manifest) so it stays in the background.
- `public/audio/sfx/attack-swing.mp3`
- `public/audio/ui/dialogue-open.mp3`
- `public/audio/ui/dialogue-close.mp3`
- `public/audio/ui/save-success.mp3`
- `public/audio/ui/save-error.mp3`

## Credits / Licenses

We are not legally required to credit Pixabay assets (the **Pixabay Content License** is
royalty-free, allows commercial use, and does **not** require attribution), and editing a clip
in Audacity does not change that. We still list sources here for transparency and so future
maintainers know each file's provenance. Verify the license on each asset's own page — almost
all uploads use the Pixabay Content License, but confirm before shipping.

| File | Source | License |
| --- | --- | --- |
| `ambient/day-ambience-loop.mp3` | https://pixabay.com/sound-effects/nature-birds-chirping-calm-173695/ | Pixabay Content License |
| `ambient/river-water-loop.mp3` | https://pixabay.com/sound-effects/nature-forest-river-sammer-450696/ (recorte en loop) | Pixabay Content License |
| `ambient/desert-ambience-loop.mp3` | https://pixabay.com/es/sound-effects/desert-sand-dunes-482890/ | Pixabay Content License |
| `ambient/snowfall-loop.mp3` | https://pixabay.com/es/sound-effects/cold-snowfall-ambience-5-minutes-sound-effect-164512/ | Pixabay Content License |
| `foley/footstep-sand-a/b.mp3`, `jump-sand.mp3` | https://pixabay.com/es/sound-effects/person-walking-through-sand-484078/ | Pixabay Content License |
| `foley/footstep-snow-a/b.mp3`, `jump-snow.mp3` | https://pixabay.com/es/sound-effects/footsteps-in-snow-102043/ | Pixabay Content License |
| `foley/footstep-stone.mp3`, `jump-stone.mp3` | https://pixabay.com/es/sound-effects/steps-on-stones-and-sand-stones-9811/ | Pixabay Content License |
| `sfx/attack-hit.mp3` | https://pixabay.com/sound-effects/film-special-effects-sword-hit-7160/ | Pixabay Content License |
| `sfx/attack-swing.mp3` | https://pixabay.com/sound-effects/film-special-effects-slash-21834/ | Pixabay Content License |
| `sfx/player-hurt-1..5.mp3`, `player-mort.mp3` | https://pixabay.com/sound-effects/people-grunts-33249/ (1-min clip; individual grunts cut out) | Pixabay Content License |

> Other foley/SFX were adapted (trimmed/processed) from Pixabay sources. Attribution is not
> required; if you have the original links handy, add them above for completeness.

## Notes

- Format can be `.mp3`, but if you prefer `.wav` or `.ogg`, update the paths in
  [src/lib/audio/manifest.ts](/d:/projects/hackathon/engram/src/lib/audio/manifest.ts).
- Loops should be trimmed cleanly to avoid clicks.
- Footsteps feel better when they are short, dry, and slightly different from one another.
- Keep files lightweight for web delivery.
