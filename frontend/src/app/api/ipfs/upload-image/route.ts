import { NextRequest, NextResponse } from 'next/server';

const PINATA_BASE = 'https://api.pinata.cloud';

export async function POST(request: NextRequest) {
  const apiKey = process.env.PINATA_API_KEY;
  const secret = process.env.PINATA_SECRET;
  if (!apiKey || !secret) {
    return NextResponse.json({ error: 'IPFS not configured' }, { status: 503 });
  }

  const form = await request.formData();
  const file = form.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const pinataForm = new FormData();
  pinataForm.append('file', file);
  pinataForm.append('pinataMetadata', JSON.stringify({ name: file.name }));
  pinataForm.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

  const res = await fetch(`${PINATA_BASE}/pinning/pinFileToIPFS`, {
    method: 'POST',
    headers: {
      pinata_api_key: apiKey,
      pinata_secret_api_key: secret,
    },
    body: pinataForm,
  });

  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: res.status });
  }

  const { IpfsHash } = await res.json() as { IpfsHash: string };
  return NextResponse.json({ IpfsHash });
}
