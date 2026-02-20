import { NextRequest, NextResponse } from 'next/server';

const PINATA_BASE = 'https://api.pinata.cloud';

export async function POST(request: NextRequest) {
  const apiKey = process.env.PINATA_API_KEY;
  const secret = process.env.PINATA_SECRET;
  if (!apiKey || !secret) {
    return NextResponse.json({ error: 'IPFS not configured' }, { status: 503 });
  }

  const body = await request.json();

  const res = await fetch(`${PINATA_BASE}/pinning/pinJSONToIPFS`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      pinata_api_key: apiKey,
      pinata_secret_api_key: secret,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: res.status });
  }

  const { IpfsHash } = await res.json() as { IpfsHash: string };
  return NextResponse.json({ IpfsHash });
}
