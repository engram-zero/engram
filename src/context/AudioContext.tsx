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
};

const AudioContext = createContext<AudioContextValue | undefined>(undefined);

type ManagedCue = {
  elements: HTMLAudioElement[];
  nextIndex: number;
};

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [audioReady, setAudioReady] = useState(false);
  const cuesRef = useRef(new Map<AudioCueId, ManagedCue>());
  const unavailableRef = useRef(new Set<string>());

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

  const value = useMemo<AudioContextValue>(
    () => ({
      audioReady,
      play,
      setLoopEnabled,
      setLoopVolume,
    }),
    [audioReady, play, setLoopEnabled, setLoopVolume]
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
