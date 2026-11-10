// Share links: the whole set lives in the URL, so sharing needs no server and no account.
// Format: "z" + base64url(deflate-raw(json)) or "j" + base64url(json) where compression is missing.

function toBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeShare(set) {
  const json = JSON.stringify({
    t: set.title,
    d: set.description || '',
    c: set.cards.map((c) => [c.term, c.def]),
  });
  const bytes = new TextEncoder().encode(json);
  if (typeof CompressionStream === 'function') {
    return 'z' + toBase64Url(await pipe(bytes, new CompressionStream('deflate-raw')));
  }
  return 'j' + toBase64Url(bytes);
}

export async function decodeShare(payload) {
  const kind = payload[0];
  let bytes = fromBase64Url(payload.slice(1));
  if (kind === 'z') {
    if (typeof DecompressionStream !== 'function') {
      throw new Error('This browser is too old to open compressed share links.');
    }
    bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  } else if (kind !== 'j') {
    throw new Error('Unrecognised share link.');
  }
  const data = JSON.parse(new TextDecoder().decode(bytes));
  if (!data || !Array.isArray(data.c)) throw new Error('Share link has no cards.');
  return {
    title: String(data.t || 'Shared set'),
    description: String(data.d || ''),
    cards: data.c.map((p) => ({ term: String(p?.[0] ?? ''), def: String(p?.[1] ?? '') })),
  };
}
