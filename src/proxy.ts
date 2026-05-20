import { NextRequest, NextResponse } from "next/server";

// Matches /api/* but NOT /api/v1/* and NOT /api/auth/[...nextauth]
const UNVERSIONED_API = /^\/api\/(?!v\d+\/)(.+)$/;

function buildCsp(nonce: string): string {
  const directives: Record<string, string> = {
    "default-src":     "'self'",
    "script-src":      `'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src":       `'self' 'nonce-${nonce}'`,
    "img-src":         "'self' data: https://res.cloudinary.com",
    "font-src":        "'self'",
    "connect-src":     "'self' https://horizon-testnet.stellar.org https://horizon.stellar.org",
    "frame-ancestors": "'none'",
    "base-uri":        "'self'",
    "form-action":     "'self'",
    "object-src":      "'none'",
    "upgrade-insecure-requests": "",
  };

  return Object.entries(directives)
    .map(([k, v]) => (v ? `${k} ${v}` : k))
    .join("; ");
}

export function proxy(req: NextRequest) {
  // ── API redirect ────────────────────────────────────────────────────────────
  const match = req.nextUrl.pathname.match(UNVERSIONED_API);
  if (match) {
    const url = req.nextUrl.clone();
    url.pathname = `/api/v1/${match[1]}`;
    const res = NextResponse.redirect(url, { status: 308 });
    res.headers.set("Deprecation", "true");
    res.headers.set("Link", `<${url.pathname}>; rel="successor-version"`);
    return res;
  }

  // ── CSP nonce ───────────────────────────────────────────────────────────────
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
  const csp   = buildCsp(nonce);

  // ── Correlation ID ──────────────────────────────────────────────────────────
  const correlationId = req.headers.get("x-correlation-id") ?? crypto.randomUUID();

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-correlation-id", correlationId);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("x-nonce", nonce);
  res.headers.set("x-correlation-id", correlationId);
  return res;
}

export const config = {
  matcher: [
    "/api/:path*",
    // Apply CSP to all page routes; skip static files and Next internals.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
