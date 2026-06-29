import React, { useState } from 'react';
import { useNetwork } from '@/app/providers';

const NETWORK_OPTIONS = [
  { id: 'standard', icon: '🐢', label: 'Standard' },
  { id: 'turbo', icon: '🐇', label: 'Turbo' },
] as const;

export default function NetworkToggle() {
  const { networkType, setNetworkType } = useNetwork();
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative inline-flex items-center gap-1.5">
      <div
        className="inline-flex items-center gap-1 rounded-full border p-1"
        style={{
          background: 'rgba(14,11,8,0.82)',
          borderColor: 'rgba(122,86,42,0.88)',
          boxShadow: '0 8px 18px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,229,179,0.08)',
        }}
      >
        {NETWORK_OPTIONS.map((option) => {
          const active = networkType === option.id;
          return (
            <button
              key={option.id}
              onClick={() => setNetworkType(option.id)}
              className="rounded-full px-3 py-1.5 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#d6b84a]/70"
              style={{
                minWidth: option.id === 'standard' ? 96 : 82,
                background: active ? '#f3e6c9' : 'transparent',
                color: active ? '#2f261d' : '#d7c29b',
                boxShadow: active ? '0 1px 6px rgba(0,0,0,0.2)' : 'none',
              }}
              aria-pressed={active}
              aria-label={`${option.label} network`}
            >
              <span className="flex items-center justify-center gap-1.5">
                {option.id === 'standard' && <span className="text-[0.9rem] leading-none">{option.icon}</span>}
                <span
                  className="leading-none"
                  style={{
                    fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                  }}
                >
                  {option.label}
                </span>
                {option.id === 'turbo' && <span className="text-[0.9rem] leading-none">{option.icon}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
      >
        <button
          className="flex h-6 w-6 items-center justify-center rounded-full border transition-colors"
          style={{
            color: '#eadfcf',
            background: 'rgba(20,16,10,0.78)',
            borderColor: 'rgba(120,82,40,0.65)',
          }}
          aria-label="Network mode information"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-3.5 w-3.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
            />
          </svg>
        </button>

        {showTooltip && (
          <div
            className="absolute right-0 z-20 mt-2 w-60 rounded-2xl border p-3 text-sm shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
            style={{
              background: 'rgba(19,15,10,0.97)',
              borderColor: 'rgba(120,82,40,0.65)',
              color: '#eadfcf',
            }}
          >
            <div className="space-y-2">
              <div>
                <div className="flex items-center gap-2 font-semibold text-[#f3e6c9]">
                  <span role="img" aria-label="tortoise">🐢</span>
                  <span>Standard</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[#c9b792]">
                  Older route. Slower and mostly here for comparison.
                </p>
              </div>
              <div className="border-t border-[#5a4a28] pt-2">
                <div className="flex items-center gap-2 font-semibold text-[#f3e6c9]">
                  <span role="img" aria-label="rabbit">🐇</span>
                  <span>Turbo</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[#c9b792]">
                  Faster route. This is the network the game currently favors.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
