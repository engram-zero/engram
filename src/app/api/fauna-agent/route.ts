import { NextResponse } from 'next/server';
import { reserve } from '@/lib/ratelimit';
import { runFaunaAgent } from '@/lib/nature-agents';
import type { FaunaAgentRequest } from '@/lib/types';

export const runtime = 'nodejs';

const isAddress = (w: unknown): w is string =>
  typeof w === 'string' && /^0x[a-fA-F0-9]{40}$/.test(w);

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

export async function POST(req: Request) {
  let body: FaunaAgentRequest;
  try {
    body = (await req.json()) as FaunaAgentRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!isAddress(body.walletAddress)) {
    return NextResponse.json({ error: 'Invalid wallet address.' }, { status: 400 });
  }
  const hasCompact = body.agentSnapshot?.version === 'nature-agent-compact-v1' && Array.isArray(body.agentSnapshot.snapshot);
  const hasLegacy = !!body.world && typeof body.world === 'object' && Array.isArray(body.snapshot);
  if (!hasCompact && !hasLegacy) {
    return NextResponse.json({ error: 'Missing nature agent snapshot.' }, { status: 400 });
  }

  const rl = reserve([`fauna:${body.walletAddress.toLowerCase()}`, `ip:${clientIp(req)}`]);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'The fauna needs a moment. Try again shortly.', retryAfter: rl.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

  try {
    const response = await runFaunaAgent(body);
    return NextResponse.json(response);
  } catch (err) {
    console.error('[api/fauna-agent]', err);
    return NextResponse.json(
      { error: 'Fauna agent failed.', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
