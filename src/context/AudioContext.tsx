'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AUDIO_CUES, type AudioCueId } from '@/lib/audio/manifest';

type PlayOptions = {
  volume?: number;
  restart?: boolean;
};

type LoopOptions = {
  volume?: number;
};

type AudioContextValue = {
  audioReady: boolean;
  play: (cueId: AudioCueId, options?: PlayOptions) => Promise<void>;
  setLoopEnabled: (cueId: AudioCueId, enabled: boolean, options?: LoopOptions) => Promise<void>;
  /**
   * Continuously set a loop's volume for distance-based (spatial) ambience. A
   * volume at/below ~0 pauses the loop; any positive volume ensures it's playing
   * and adjusts gain WITHOUT restarting it — safe to call every frame/tick.
   */
  setLoopVolume: (cueId: AudioCueId, volume: number) => Promise<void>;
  /** Whether all sound is muted. Persisted across sessions. */
  muted: boolean;
  /** Toggle global mute (or set explicitly). */
  setMuted: (next: boolean) => void;
};

const MUTE_STORAGE_KEY = 'engram:audioMuted';

function readStoredMute(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

const AudioContext = createContext<AudioContextValue | undefined>(undefined);

type ManagedCue = {
  elements: HTMLAudioElement[];
  nextIndex: number;
};

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [audioReady, setAudioReady] = useState(false);
  const [muted, setMutedState] = useState(false);
  const cuesRef = useRef(new Map<AudioCueId, ManagedCue>());
  const unavailableRef = useRef(new Set<string>());
  const mutedRef = useRef(false);

  // Looping ambience plays through the Web Audio API (decoded buffer with loop=true)
  // instead of <audio loop>, which has an audible gap on each restart. Each loop cue
  // gets a GainNode we ramp for spatial/mute volume; a shared master gain does mute.
  const waCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const webLoopsRef = useRef(new Map<AudioCueId, { gain: GainNode }>());

  const ensureWaCtx = useCallback((): AudioContext | null => {
    if (waCtxRef.current) return waCtxRef.current;
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = mutedRef.current ? 0 : 1;
    master.connect(ctx.destination);
    waCtxRef.current = ctx;
    masterGainRef.current = master;
    return ctx;
  }, []);

  /** Lazily decode a loop cue into a gapless Web Audio source; returns its GainNode. */
  const ensureWebLoop = useCallback(async (cueId: AudioCueId): Promise<GainNode | null> => {
    const existing = webLoopsRef.current.get(cueId);
    if (existing) return existing.gain;
    const ctx = ensureWaCtx();
    if (!ctx || !masterGainRef.current) return null;
    const cue = AUDIO_CUES[cueId];
    const src = Array.isArray(cue.src) ? cue.src[0] : cue.src;
    if (unavailableRef.current.has(src)) return null;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(masterGainRef.current);
    webLoopsRef.current.set(cueId, { gain }); // reserve so we don't double-create
    try {
      const res = await fetch(src);
      const buf = await res.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(buf);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = true;
      source.connect(gain);
      source.start();
    } catch {
      unavailableRef.current.add(src);
      webLoopsRef.current.delete(cueId);
      return null;
    }
    return gain;
  }, [ensureWaCtx]);

  // Always start a fresh page load with sound ON. This is a demo/hackathon build:
  // judges (and us) should hear the world every session and notice the 🔊/🎤 buttons.
  // The mute toggle still works within the session — we just don't carry a previous
  // session's mute across reloads (a once-muted session would otherwise stay silent
  // forever and the player would miss the audio/voice value). We keep readStoredMute
  // around in case we ever want an opt-in "remember mute" later.
  void readStoredMute;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Create + resume the Web Audio context inside the first gesture (some browsers
    // require it) so gapless loops can start.
    const unlock = () => {
      setAudioReady(true);
      const ctx = ensureWaCtx();
      if (ctx && ctx.state === 'suspended') void ctx.resume();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [ensureWaCtx]);

  const getCue = useCallback((cueId: AudioCueId): ManagedCue | null => {
    if (typeof window === 'undefined') return null;
    const existing = cuesRef.current.get(cueId);
    if (existing) return existing;

    const cue = AUDIO_CUES[cueId];
    const sources = Array.isArray(cue.src) ? cue.src : [cue.src];
    const elements = sources
      .filter((src) => !unavailableRef.current.has(src))
      .map((src) => {
        const audio = new Audio(src);
        audio.preload = cue.loop ? 'auto' : 'none';
        audio.loop = !!cue.loop;
        audio.volume = cue.volume;
        audio.muted = mutedRef.current;
        audio.addEventListener('error', () => {
          unavailableRef.current.add(src);
        });
        return audio;
      });

    if (elements.length === 0) return null;
    const managed: ManagedCue = { elements, nextIndex: 0 };
    cuesRef.current.set(cueId, managed);
    return managed;
  }, []);

  const play = useCallback(
    async (cueId: AudioCueId, options?: PlayOptions) => {
      if (!audioReady) return;
      const cue = AUDIO_CUES[cueId];
      const managed = getCue(cueId);
      if (!managed || managed.elements.length === 0) return;

      // Pick the next element that isn't known-unavailable. Always advance the
      // cursor so a 404'd variant can't permanently stall the rotation.
      let element: HTMLAudioElement | null = null;
      for (let i = 0; i < managed.elements.length; i++) {
        const candidate = managed.elements[managed.nextIndex % managed.elements.length];
        managed.nextIndex += 1;
        if (!unavailableRef.current.has(candidate.currentSrc || candidate.src)) {
          element = candidate;
          break;
        }
      }
      if (!element) return;
      if (options?.restart !== false) element.currentTime = 0;
      element.loop = !!cue.loop;
      element.volume = options?.volume ?? cue.volume;
      try {
        await element.play();
      } catch {
        unavailableRef.current.add(element.currentSrc || element.src);
      }
    },
    [audioReady, getCue]
  );

  const setLoopEnabled = useCallback(
    async (cueId: AudioCueId, enabled: boolean, options?: LoopOptions) => {
      const cue = AUDIO_CUES[cueId];
      if (!cue.loop || !audioReady) return;
      const ctx = ensureWaCtx();
      if (ctx && ctx.state === 'suspended') void ctx.resume();
      const gain = await ensureWebLoop(cueId);
      if (!gain || !ctx) return;
      gain.gain.setTargetAtTime(enabled ? (options?.volume ?? cue.volume) : 0, ctx.currentTime, 0.05);
    },
    [audioReady, ensureWaCtx, ensureWebLoop]
  );

  const setLoopVolume = useCallback(
    async (cueId: AudioCueId, volume: number) => {
      const cue = AUDIO_CUES[cueId];
      if (!cue.loop || !audioReady) return;
      const v = Math.max(0, Math.min(1, volume));
      const ctx = ensureWaCtx();
      if (ctx && ctx.state === 'suspended') void ctx.resume();
      const gain = await ensureWebLoop(cueId);
      if (!gain || !ctx) return;
      gain.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
    },
    [audioReady, ensureWaCtx, ensureWebLoop]
  );

  const setMuted = useCallback((next: boolean) => {
    mutedRef.current = next;
    setMutedState(next);
    try {
      window.localStorage.setItem(MUTE_STORAGE_KEY, next ? '1' : '0');
    } catch {
      // ignore storage failures (private mode, etc.)
    }
    // One-shots: gate each HTML element. Loops: the shared Web Audio master gain.
    for (const managed of cuesRef.current.values()) {
      for (const element of managed.elements) {
        element.muted = next;
      }
    }
    if (masterGainRef.current && waCtxRef.current) {
      masterGainRef.current.gain.setTargetAtTime(next ? 0 : 1, waCtxRef.current.currentTime, 0.02);
    }
  }, []);

  const value = useMemo<AudioContextValue>(
    () => ({
      audioReady,
      play,
      setLoopEnabled,
      setLoopVolume,
      muted,
      setMuted,
    }),
    [audioReady, play, setLoopEnabled, setLoopVolume, muted, setMuted]
  );

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

export function useEngramAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useEngramAudio must be used within AudioProvider');
  }
  return context;
}
