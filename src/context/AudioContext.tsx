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

  // Always start a fresh page load with sound ON. This is a demo/hackathon build:
  // judges (and us) should hear the world every session and notice the 🔊/🎤 buttons.
  // The mute toggle still works within the session — we just don't carry a previous
  // session's mute across reloads (a once-muted session would otherwise stay silent
  // forever and the player would miss the audio/voice value). We keep readStoredMute
  // around in case we ever want an opt-in "remember mute" later.
  void readStoredMute;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const unlock = () => setAudioReady(true);
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

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
      if (!cue.loop) return;
      const managed = getCue(cueId);
      if (!managed) return;

      for (const element of managed.elements) {
        if (unavailableRef.current.has(element.currentSrc || element.src)) continue;
        element.loop = true;
        element.volume = options?.volume ?? cue.volume;
        if (!enabled) {
          element.pause();
          element.currentTime = 0;
          continue;
        }
        if (!audioReady) continue;
        if (!element.paused) continue;
        try {
          await element.play();
        } catch {
          unavailableRef.current.add(element.currentSrc || element.src);
        }
      }
    },
    [audioReady, getCue]
  );

  const setLoopVolume = useCallback(
    async (cueId: AudioCueId, volume: number) => {
      const cue = AUDIO_CUES[cueId];
      if (!cue.loop) return;
      const managed = getCue(cueId);
      if (!managed) return;
      const v = Math.max(0, Math.min(1, volume));

      for (const element of managed.elements) {
        if (unavailableRef.current.has(element.currentSrc || element.src)) continue;
        element.loop = true;
        if (v <= 0.001) {
          if (!element.paused) element.pause();
          continue;
        }
        element.volume = v;
        if (!audioReady) continue;
        if (!element.paused) continue;
        try {
          await element.play();
        } catch {
          unavailableRef.current.add(element.currentSrc || element.src);
        }
      }
    },
    [audioReady, getCue]
  );

  const setMuted = useCallback((next: boolean) => {
    mutedRef.current = next;
    setMutedState(next);
    try {
      window.localStorage.setItem(MUTE_STORAGE_KEY, next ? '1' : '0');
    } catch {
      // ignore storage failures (private mode, etc.)
    }
    // Apply to every element already created. Loops keep running silently so the
    // per-tick spatial volume logic stays correct; .muted just gates audible output.
    for (const managed of cuesRef.current.values()) {
      for (const element of managed.elements) {
        element.muted = next;
      }
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
