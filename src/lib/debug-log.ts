type LogFn = (...args: unknown[]) => void;

function debugEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_ENGRAM_DEBUG ?? process.env.ENGRAM_DEBUG;
  return raw === '1' || raw?.toLowerCase() === 'true';
}

function guarded(fn: LogFn): LogFn {
  return (...args) => {
    if (debugEnabled()) fn(...args);
  };
}

export const debugLog = guarded(console.log.bind(console));
export const debugInfo = guarded(console.info.bind(console));
export const debugWarn = guarded(console.warn.bind(console));
export const debugError = guarded(console.error.bind(console));
