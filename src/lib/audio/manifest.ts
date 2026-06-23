export type AudioCueId =
  | 'night_crickets'
  | 'campfire_crackle'
  | 'footstep_grass'
  | 'jump'
  | 'land'
  | 'axe_chop'
  | 'attack_swing'
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
  campfire_crackle: {
    label: 'Campfire crackle loop',
    src: '/audio/ambient/campfire-crackle-loop.mp3',
    loop: true,
    volume: 0.22,
  },
  footstep_grass: {
    label: 'Footsteps on grass/dirt',
    // Only list files that actually exist — a missing variant 404s and would stall
    // playback. Add '-02'…'-04' here once those files are in public/audio/foley/.
    src: ['/audio/foley/footstep-grass-01.mp3'],
    volume: 0.34,
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
  attack_swing: {
    label: 'Player attack swing',
    src: '/audio/sfx/attack-swing.mp3',
    volume: 0.26,
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
  '/audio/ambient/campfire-crackle-loop.mp3',
  '/audio/foley/footstep-grass-01.mp3',
  '/audio/foley/footstep-grass-02.mp3',
  '/audio/foley/footstep-grass-03.mp3',
  '/audio/foley/footstep-grass-04.mp3',
  '/audio/foley/jump-takeoff.mp3',
  '/audio/foley/land-dirt.mp3',
  '/audio/foley/axe-chop-hit.mp3',
  '/audio/sfx/attack-swing.mp3',
  '/audio/ui/dialogue-open.mp3',
  '/audio/ui/dialogue-close.mp3',
  '/audio/ui/save-success.mp3',
  '/audio/ui/save-error.mp3',
] as const;
