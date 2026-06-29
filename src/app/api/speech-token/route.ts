import { NextResponse } from 'next/server';

// Mints a short-lived (~10 min) Azure Speech authorization token so the browser can
// run STT/TTS via the Speech SDK WITHOUT ever seeing AZURE_SPEECH_KEY. The key stays
// server-side; only the disposable token + region reach the client.
export async function GET() {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    return NextResponse.json({ error: 'Speech is not configured.' }, { status: 503 });
  }
  try {
    const res = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Length': '0' },
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'Could not mint a speech token.' }, { status: 502 });
    }
    const token = await res.text();
    return NextResponse.json({ token, region });
  } catch {
    return NextResponse.json({ error: 'Speech token request failed.' }, { status: 502 });
  }
}
