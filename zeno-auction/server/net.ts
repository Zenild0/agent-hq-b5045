/**
 * The visitor's address, for the wrong-key throttle. Behind a reverse proxy (Caddy / nginx) every
 * connection arrives from the proxy itself, so the real address is in X-Forwarded-For — but only
 * trust that header when the operator says a proxy is in front (TRUST_PROXY), otherwise anyone
 * could forge it. With one proxy the real address is the last entry the proxy appended.
 */
export function clientIp(remote: string | undefined, forwardedFor: string | string[] | undefined, trustProxy: boolean): string {
  if (trustProxy && forwardedFor) {
    const parts = (Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return remote ?? '';
}
