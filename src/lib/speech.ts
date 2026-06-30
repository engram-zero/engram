'use client';

// Browser speech via the Azure Speech SDK, using a short-lived token from
// /api/speech-token (the key never reaches the client). STT fills the chat input
// (the player confirms/edits before sending); TTS gives NPCs an optional voice.

import type { NPCName } from '@/lib/types';

type Cred = { token: string; region: string };
let cached: (Cred & { at: number }) | null = null;

/** Cached auth token (Azure tokens last ~10 min; refresh after 8). */
async function getCred(): Promise<Cred | null> {
  if (cached && Date.now() - cached.at < 8 * 60_000) return cached;
  try {
    const res = await fetch('/api/speech-token');
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<Cred>;
    if (!data.token || !data.region) return null;
    cached = { token: data.token, region: data.region, at: Date.now() };
    return cached;
  } catch {
    return null;
  }
}

/** True when the deployment has Azure Speech env vars set. */
export async function isSpeechAvailable(): Promise<boolean> {
  return (await getCred()) !== null;
}

const MAX_WORDS = 60;
function capWords(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length <= MAX_WORDS ? text.trim() : words.slice(0, MAX_WORDS).join(' ');
}

export type Dictation = { stop: () => void };

/**
 * Start dictating from the default mic. Auto-detects Spanish/English and
 * accumulates each recognized segment. It closes on its own after a natural
 * pause (so the player needn't do anything), but the returned `stop()` lets the
 * UI end it immediately ("I'm done talking"). `onFinal` fires exactly once with
 * the word-capped transcript (empty string if nothing was heard). Returns null
 * if speech isn't available.
 */
export async function beginDictation(
  onFinal: (text: string) => void,
  autoSilenceMs = 2600,
): Promise<Dictation | null> {
  const cred = await getCred();
  if (!cred) return null;
  const SDK = await import('microsoft-cognitiveservices-speech-sdk');
  const speechConfig = SDK.SpeechConfig.fromAuthorizationToken(cred.token, cred.region);
  const auto = SDK.AutoDetectSourceLanguageConfig.fromLanguages(['es-MX', 'en-US']);
  const audioConfig = SDK.AudioConfig.fromDefaultMicrophoneInput();
  const recognizer = SDK.SpeechRecognizer.FromConfig(speechConfig, auto, audioConfig);

  const parts: string[] = [];
  let done = false;
  let silenceTimer: ReturnType<typeof setTimeout> | undefined;

  const finalize = () => {
    if (done) return;
    done = true;
    if (silenceTimer) clearTimeout(silenceTimer);
    const text = capWords(parts.join(' ').trim());
    recognizer.stopContinuousRecognitionAsync(
      () => { try { recognizer.close(); } catch { /* ignore */ } onFinal(text); },
      () => { try { recognizer.close(); } catch { /* ignore */ } onFinal(text); },
    );
  };

  // Each finalized segment resets the "they've stopped talking" countdown.
  recognizer.recognized = (_s, e) => {
    if (e.result.reason === SDK.ResultReason.RecognizedSpeech && e.result.text) {
      parts.push(e.result.text);
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(finalize, autoSilenceMs);
    }
  };
  recognizer.canceled = () => finalize();

  await new Promise<void>((res) =>
    recognizer.startContinuousRecognitionAsync(() => res(), () => res()),
  );
  // If the player never speaks, still close after a generous window.
  silenceTimer = setTimeout(finalize, autoSilenceMs + 5000);
  return { stop: finalize };
}

// A distinct neural voice + prosody per villager. Aldric uses Maren's old voice and
// vice-versa; Sable is a wise, old wizard — a dignified British voice slowed and
// lowered via SSML so he reads elderly and sage.
const NPC_VOICE: Record<NPCName, { name: string; rate?: string; pitch?: string }> = {
  aldric: { name: 'en-US-DavisNeural' },                         // warm male merchant
  maren: { name: 'en-US-TonyNeural' },                           // (was Sable's — male)
  sable: { name: 'en-GB-RyanNeural', rate: '-14%', pitch: '-12%' }, // old wise wizard
};

// NPC replies sometimes contain markdown / roleplay markup (e.g. **bold**, *adjusts
// hat*, `code`). The synthesizer would otherwise read the symbols out loud
// ("asterisk adjusts hat asterisk"). Strip the markers — and drop *stage directions*
// entirely, since they're non-verbal asides not meant to be spoken — keeping the
// on-screen text untouched.
function forSpeech(text: string): string {
  return text
    .replace(/\*[^*\n]+\*/g, ' ')      // *stage direction* / *italic aside* → gone
    .replace(/[*_`#~>]/g, ' ')          // any stray markdown markers → space
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let synth: import('microsoft-cognitiveservices-speech-sdk').SpeechSynthesizer | null = null;

/** Speak `text` in the NPC's voice (best-effort; silently no-ops if unavailable). */
export async function speakText(text: string, npc?: NPCName): Promise<void> {
  const cred = await getCred();
  const spoken = forSpeech(text);
  if (!cred || !spoken) return;
  const SDK = await import('microsoft-cognitiveservices-speech-sdk');
  const speechConfig = SDK.SpeechConfig.fromAuthorizationToken(cred.token, cred.region);
  const voice = (npc && NPC_VOICE[npc]) || { name: 'en-US-DavisNeural' };
  speechConfig.speechSynthesisVoiceName = voice.name;
  const lang = voice.name.slice(0, 5); // e.g. "en-GB"
  const prosody = voice.rate || voice.pitch
    ? `<prosody rate="${voice.rate ?? '0%'}" pitch="${voice.pitch ?? '0%'}">${escapeXml(spoken)}</prosody>`
    : escapeXml(spoken);
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}"><voice name="${voice.name}">${prosody}</voice></speak>`;
  try {
    synth?.close();
  } catch {
    /* ignore */
  }
  synth = new SDK.SpeechSynthesizer(speechConfig);
  const active = synth;
  await new Promise<void>((resolve) => {
    active.speakSsmlAsync(
      ssml,
      () => {
        try { active.close(); } catch { /* ignore */ }
        resolve();
      },
      () => {
        try { active.close(); } catch { /* ignore */ }
        resolve();
      },
    );
  });
}

export function stopSpeaking(): void {
  try {
    synth?.close();
  } catch {
    /* ignore */
  }
  synth = null;
}
