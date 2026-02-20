export async function uploadImageToIPFS(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch('/api/ipfs/upload-image', { method: 'POST', body: form });
  if (!res.ok) {
    const { error } = await res.json() as { error: string };
    throw new Error(`Image upload failed: ${error}`);
  }
  const { IpfsHash } = await res.json() as { IpfsHash: string };
  return IpfsHash;
}

export interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string; // ipfs://CID
  external_url?: string;
  twitter?: string;
  telegram?: string;
}

export async function uploadMetadataToIPFS(metadata: TokenMetadata): Promise<string> {
  const res = await fetch('/api/ipfs/upload-metadata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pinataContent: metadata,
      pinataMetadata: { name: `${metadata.symbol}-metadata` },
    }),
  });

  if (!res.ok) {
    const { error } = await res.json() as { error: string };
    throw new Error(`Metadata upload failed: ${error}`);
  }
  const { IpfsHash } = await res.json() as { IpfsHash: string };
  return IpfsHash;
}

export function ipfsToHttp(cid: string): string {
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
}

export function ipfsUriToHttp(uri: string): string {
  if (uri.startsWith('ipfs://')) return ipfsToHttp(uri.slice(7));
  return uri;
}
