/**
 * Block SSRF - reject URLs that point to internal/private networks.
 * Used before any server-side fetch of user-supplied URLs.
 */
export function assertExternalUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }

  const proto = parsed.protocol;
  if (proto !== 'https:' && proto !== 'http:') {
    throw new Error('URL must use http or https');
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const blocked = [
    'localhost',
    '0.0.0.0',
    '::1',
    '169.254.169.254', // AWS/Azure metadata
    'metadata.google.internal', // GCP metadata
  ];
  if (blocked.includes(host) || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new Error('URL points to a blocked address');
  }

  // IPv6 (incl. IPv4-mapped like ::ffff:169.254.169.254) - block anything that
  // isn't clearly a public address. Simplest safe policy: reject IPv6 literals.
  if (host.includes(':')) {
    throw new Error('URL points to a blocked address');
  }

  // Resolve any IPv4 form (dotted, decimal, hex, octal) to octets, then block
  // private/loopback/link-local/reserved ranges. Previously only plain dotted
  // decimal was checked, so http://2130706433/ or http://0177.0.0.1 slipped by.
  const octets = ipv4Octets(host);
  if (octets) {
    const [a, b] = octets;
    if (a === 10) throw new Error('URL points to a private network');
    if (a === 127) throw new Error('URL points to a loopback address');
    if (a === 0) throw new Error('URL points to a reserved address');
    if (a === 169 && b === 254) throw new Error('URL points to a link-local address');
    if (a === 172 && b >= 16 && b <= 31) throw new Error('URL points to a private network');
    if (a === 192 && b === 168) throw new Error('URL points to a private network');
    if (a === 100 && b >= 64 && b <= 127) throw new Error('URL points to a carrier-grade NAT address');
    if (a >= 224) throw new Error('URL points to a reserved/multicast address');
  }
}

/**
 * Parse an IPv4 address in any of the forms browsers/libc accept - dotted
 * decimal (1.2.3.4), a single 32-bit decimal (2130706433), or dotted octal/hex
 * (0177.0.0.1, 0x7f.0.0.1) - into its four octets. Returns null if `host` is
 * not an all-numeric IPv4 literal (i.e. it's a hostname to resolve elsewhere).
 */
function ipv4Octets(host: string): [number, number, number, number] | null {
  const partsRaw = host.split('.');
  const toNum = (s: string): number | null => {
    if (/^0x[0-9a-f]+$/i.test(s)) return parseInt(s, 16);
    if (/^0[0-7]+$/.test(s)) return parseInt(s, 8);
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    return null;
  };
  if (partsRaw.length === 4) {
    const nums = partsRaw.map(toNum);
    if (nums.some((n) => n === null || n! < 0 || n! > 255)) return null;
    return [nums[0]!, nums[1]!, nums[2]!, nums[3]!];
  }
  if (partsRaw.length === 1) {
    const n = toNum(partsRaw[0]!);
    if (n === null || n < 0 || n > 0xffffffff) return null;
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  }
  return null;
}
