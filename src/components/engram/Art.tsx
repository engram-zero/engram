'use client';

// Hand-built inline SVG — illustrated village backdrop + three distinct NPC
// portraits. No external assets, no network fetch.
import React from 'react';
import type { NPCName } from '@/lib/types';

export function Village() {
  return (
    <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1b2845" />
          <stop offset="45%" stopColor="#3a4a6b" />
          <stop offset="100%" stopColor="#b07a5a" />
        </linearGradient>
        <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5a6b4a" />
          <stop offset="100%" stopColor="#3a4632" />
        </linearGradient>
        <radialGradient id="moon" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff7e0" />
          <stop offset="100%" stopColor="#f0d890" />
        </radialGradient>
      </defs>

      <rect width="1200" height="700" fill="url(#sky)" />
      <circle cx="980" cy="130" r="58" fill="url(#moon)" opacity="0.95" />
      {Array.from({ length: 40 }).map((_, i) => (
        <circle key={i} cx={(i * 137) % 1200} cy={(i * 53) % 300} r={i % 3 === 0 ? 1.6 : 1} fill="#fff" opacity="0.7" />
      ))}

      <path d="M0 430 Q300 360 600 420 T1200 410 V700 H0 Z" fill="#2f3b52" opacity="0.8" />

      <Cottage x={120} y={360} c="#7a5a3a" roof="#8a3a2a" />
      <Cottage x={360} y={390} c="#6a4a32" roof="#7a4a2a" scale={0.85} />
      <Cottage x={760} y={385} c="#7a5a3a" roof="#5a3a6a" scale={0.95} />
      <Cottage x={980} y={360} c="#6a4a32" roof="#8a3a2a" />

      <rect y={500} width="1200" height="200" fill="url(#ground)" />
      <path d="M520 700 L560 500 L640 500 L680 700 Z" fill="#7a6f55" opacity="0.7" />
      <circle cx="600" cy="470" r="40" fill="#ffcf7a" opacity="0.18" />
    </svg>
  );
}

function Cottage({ x, y, c, roof, scale = 1 }: { x: number; y: number; c: string; roof: string; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect x="0" y="40" width="120" height="80" fill={c} />
      <path d="M-12 44 L60 0 L132 44 Z" fill={roof} />
      <rect x="48" y="80" width="26" height="40" fill="#2a1f17" />
      <rect x="14" y="58" width="22" height="22" fill="#ffcf7a" opacity="0.85" />
      <rect x="86" y="58" width="22" height="22" fill="#ffcf7a" opacity="0.85" />
    </g>
  );
}

const FACE = '#e8c4a0';
const FACE_SHADOW = '#cda484';

export function Portrait({ npc, size = 96, talking = false }: { npc: NPCName | string; size?: number; talking?: boolean }) {
  const Inner = ({ aldric: AldricFace, maren: MarenFace, sable: SableFace } as const)[npc as NPCName] || AldricFace;
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={talking ? 'engram-portrait engram-bob' : 'engram-portrait'}
      aria-hidden
    >
      <Inner />
    </svg>
  );
}

function AldricFace() {
  return (
    <g>
      <circle cx="60" cy="60" r="56" fill="#2a2316" />
      <rect x="34" y="70" width="52" height="46" rx="8" fill="#7a5a2a" />
      <ellipse cx="60" cy="58" rx="24" ry="27" fill={FACE} />
      <path d="M36 56 Q60 40 84 56 L82 44 Q60 30 38 44 Z" fill="#8a6a3a" />
      <circle cx="51" cy="58" r="3.2" fill="#3a2a1a" />
      <circle cx="69" cy="58" r="3.2" fill="#3a2a1a" />
      <path d="M44 50 Q51 46 57 50" stroke="#5a4326" strokeWidth="2" fill="none" />
      <path d="M63 50 Q69 46 76 50" stroke="#5a4326" strokeWidth="2" fill="none" />
      <path d="M40 70 Q60 96 80 70 Q72 86 60 88 Q48 86 40 70 Z" fill="#cfc3b0" />
      <path d="M40 70 Q60 94 80 70 Q72 84 60 86 Q48 84 40 70 Z" fill="#b9ad96" />
      <path d="M50 70 Q60 78 70 70" stroke="#9a3a2a" strokeWidth="2.5" fill="none" />
      <circle cx="92" cy="92" r="9" fill="#e6c34a" stroke="#a8861f" strokeWidth="2" />
      <text x="92" y="96" textAnchor="middle" fontSize="9" fill="#7a6010">$</text>
    </g>
  );
}

function MarenFace() {
  return (
    <g>
      <circle cx="60" cy="60" r="56" fill="#16202a" />
      <rect x="32" y="74" width="56" height="42" rx="6" fill="#4a5a6a" />
      <path d="M34 78 L60 70 L86 78 L80 94 L40 94 Z" fill="#6a7a8a" />
      <ellipse cx="60" cy="58" rx="23" ry="26" fill={FACE} />
      <path d="M34 56 Q60 26 86 56 L86 50 Q60 22 34 50 Z" fill="#8a97a4" />
      <rect x="58" y="34" width="4" height="30" fill="#6a7886" />
      <circle cx="51" cy="58" r="3.2" fill="#27323a" />
      <circle cx="69" cy="58" r="3.2" fill="#27323a" />
      <path d="M44 49 Q51 45 57 49" stroke="#3a2a1a" strokeWidth="2.4" fill="none" />
      <path d="M63 49 Q69 45 76 49" stroke="#3a2a1a" strokeWidth="2.4" fill="none" />
      <path d="M52 74 Q60 78 68 74" stroke="#a06a55" strokeWidth="2.4" fill="none" />
      <path d="M55 64 L52 70 L58 70 Z" fill={FACE_SHADOW} />
      <rect x="86" y="78" width="6" height="30" fill="#9aa6b2" />
      <rect x="80" y="84" width="18" height="5" fill="#c8b06a" />
    </g>
  );
}

function SableFace() {
  return (
    <g>
      <circle cx="60" cy="60" r="56" fill="#1a1226" />
      <path d="M22 116 Q26 56 60 50 Q94 56 98 116 Z" fill="#3a2a55" />
      <path d="M30 70 Q60 28 90 70 L90 116 L30 116 Z" fill="#2a1d40" />
      <ellipse cx="60" cy="62" rx="22" ry="25" fill={FACE} />
      <path d="M36 54 Q60 34 84 54 Q60 46 36 54 Z" fill="#1d1330" opacity="0.7" />
      <path d="M40 60 Q47 56 55 60" stroke="#2a1d40" strokeWidth="2.4" fill="none" />
      <path d="M65 60 Q73 56 80 60" stroke="#2a1d40" strokeWidth="2.4" fill="none" />
      <circle cx="50" cy="62" r="3" fill="#7b4fc0" />
      <circle cx="70" cy="62" r="3" fill="#7b4fc0" />
      <path d="M50 78 Q60 86 72 76" stroke="#9a5a6a" strokeWidth="2.4" fill="none" />
      <circle cx="82" cy="74" r="3" fill="#d6b84a" />
    </g>
  );
}
