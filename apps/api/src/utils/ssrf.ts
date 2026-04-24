/**
 * Block SSRF — reject URLs that point to internal/private networks.
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

  const host = parsed.hostname.toLowerCase();
  const blocked = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '169.254.169.254', // AWS metadata
    'metadata.google.internal', // GCP metadata
  ];
  if (blocked.includes(host)) {
    throw new Error('URL points to a blocked address');
  }

  // Block private IP ranges
  const parts = host.split('.').map(Number);
  if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
    if (parts[0] === 10) throw new Error('URL points to a private network');
    if (parts[0] === 172 && parts[1]! >= 16 && parts[1]! <= 31) throw new Error('URL points to a private network');
    if (parts[0] === 192 && parts[1] === 168) throw new Error('URL points to a private network');
  }
}
