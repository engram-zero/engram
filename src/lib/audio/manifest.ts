export type AudioCueId =
  | 'night_crickets'
  | 'day_ambience'
  | 'campfire_crackle'
  | 'river_water'
  | 'desert_ambience'
  | 'snowfall'
  | 'footstep_sand'
  | 'footstep_snow'
  | 'footstep_stone'
  | 'jump_sand'
  | 'jump_snow'
  | 'jump_stone'
  | 'footstep_grass'
  | 'footstep_water'
  | 'jump'
  | 'land'
  | 'axe_chop'
  | 'mine_hit'
  | 'attack_swing'
  | 'attack_hit'
  | 'player_hurt'
  | 'player_death'
  | 'dialogue_open'
  | 'dialogue_close'
  | 'save_success'
  | 'save_error';

export type AudioCue = {
  label: string;
  src: string | string[];
  loop?: boolean;
  volume: number;
};

export const AUDIO_CUES: Record<AudioCueId, AudioCue> = {
  night_crickets: {
    label: 'Ambient night crickets loop',
    src: '/audio/ambient/night-crickets-loop.mp3',
    loop: true,
    volume: 0.24,
  },
  day_ambience: {
    label: 'Ambient daytime loop (birds/breeze)',
    src: '/audio/ambient/day-ambience-loop.mp3',
    loop: true,
    // Kept very low on purpose: a relaxing bed (birds/air) that never competes
    // with foley/dialogue — just soft background.
    volume: 0.06,
  },
  campfire_crackle: {
    label: 'Campfire crackle loop',
    src: '/audio/ambient/campfire-crackle-loop.mp3',
    loop: true,
    volume: 0.22,
  },
  river_water: {
    label: 'Flowing water loop — heard near the creek (spatial)',
    src: '/audio/ambient/river-water-loop.mp3',
    loop: true,
    volume: 0.5,
  },
  desert_ambience: {
    label: 'Desert wind/dunes ambience (spatial — the sand biome)',
    src: '/audio/ambient/desert-ambience-loop.mp3',
    loop: true,
    volume: 0.5,
  },
  snowfall: {
    label: 'Cold snowfall ambience (spatial — the snow biome)',
    src: '/audio/ambient/snowfall-loop.mp3',
    loop: true,
    volume: 0.55,
  },
  // Footsteps alternate a→b for a natural cadence (the cue rotates array variants).
  footstep_sand: {
    label: 'Footsteps on sand (alternating a/b)',
    src: ['/audio/foley/footstep-sand-a.mp3', '/audio/foley/footstep-sand-b.mp3'],
    volume: 0.4,
  },
  footstep_snow: {
    label: 'Footsteps on snow (alternating a/b)',
    src: ['/audio/foley/footstep-snow-a.mp3', '/audio/foley/footstep-snow-b.mp3'],
    volume: 0.42,
  },
  footstep_stone: {
    label: 'Footsteps on stone/cracked earth (kept low — it is sharp)',
    src: '/audio/foley/footstep-stone.mp3',
    volume: 0.22,
  },
  jump_sand: { label: 'Jump take-off on sand', src: '/audio/foley/jump-sand.mp3', volume: 0.32 },
  jump_snow: { label: 'Jump take-off on snow', src: '/audio/foley/jump-snow.mp3', volume: 0.32 },
  jump_stone: { label: 'Jump take-off on stone', src: '/audio/foley/jump-stone.mp3', volume: 0.26 },
  footstep_grass: {
    label: 'Footsteps on grass/dirt',
    // Only list files that actually exist — a missing variant 404s and would stall
    // playback. Add '-02'…'-04' here once those files are in public/audio/foley/.
    src: ['/audio/foley/footstep-grass-01.mp3'],
    volume: 0.34,
  },
  footstep_water: {
    label: 'Footsteps splashing through the creek',
    src: '/audio/foley/footstep-water.mp3',
    volume: 0.36,
  },
  jump: {
    label: 'Jump takeoff',
    src: '/audio/foley/jump-takeoff.mp3',
    volume: 0.22,
  },
  land: {
    label: 'Landing on dirt/grass',
    src: '/audio/foley/land-dirt.mp3',
    volume: 0.28,
  },
  axe_chop: {
    label: 'Axe hit on tree',
    src: '/audio/foley/axe-chop-hit.mp3',
    volume: 0.34,
  },
  mine_hit: {
    label: 'Pickaxe hit on rock',
    // Distinct from axe_chop — a stony "tink/crack". Falls back to silence until
    // the asset is added (see AUDIO_ASSET_TODO).
    src: '/audio/foley/mine-hit.mp3',
    volume: 0.36,
  },
  attack_swing: {
    label: 'Player attack swing',
    src: '/audio/sfx/attack-swing.mp3',
    volume: 0.26,
  },
  attack_hit: {
    label: 'Attack connects (impact on an enemy)',
    src: '/audio/sfx/attack-hit.mp3',
    volume: 0.3,
  },
  player_hurt: {
    label: 'Player takes a hit (rotates variants so it isn’t monotonous)',
    src: [
      '/audio/sfx/player-hurt-1.mp3',
      '/audio/sfx/player-hurt-2.mp3',
      '/audio/sfx/player-hurt-3.mp3',
      '/audio/sfx/player-hurt-4.mp3',
      '/audio/sfx/player-hurt-5.mp3',
    ],
    volume: 0.34,
  },
  player_death: {
    label: 'Player dies (HP reaches 0)',
    src: '/audio/sfx/player-mort.mp3',
    volume: 0.42,
  },
  dialogue_open: {
    label: 'Open NPC dialogue',
    src: '/audio/ui/dialogue-open.mp3',
    volume: 0.2,
  },
  dialogue_close: {
    label: 'Close NPC dialogue',
    src: '/audio/ui/dialogue-close.mp3',
    volume: 0.18,
  },
  save_success: {
    label: 'Successful save to 0G',
    src: '/audio/ui/save-success.mp3',
    volume: 0.24,
  },
  save_error: {
    label: 'Failed save',
    src: '/audio/ui/save-error.mp3',
    volume: 0.24,
  },
};

export const AUDIO_ASSET_TODO = [
  '/audio/ambient/night-crickets-loop.mp3',
  '/audio/ambient/day-ambience-loop.mp3',
  '/audio/ambient/campfire-crackle-loop.mp3',
  '/audio/foley/footstep-grass-01.mp3',
  '/audio/foley/footstep-grass-02.mp3',
  '/audio/foley/footstep-grass-03.mp3',
  '/audio/foley/footstep-grass-04.mp3',
  '/audio/foley/jump-takeoff.mp3',
  '/audio/foley/land-dirt.mp3',
  '/audio/foley/footstep-water.mp3',
  '/audio/foley/axe-chop-hit.mp3',
  '/audio/foley/mine-hit.mp3',
  '/audio/sfx/attack-swing.mp3',
  '/audio/ui/dialogue-open.mp3',
  '/audio/ui/dialogue-close.mp3',
  '/audio/ui/save-success.mp3',
  '/audio/ui/save-error.mp3',
] as const;
