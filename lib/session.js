/**
 * session.js
 *
 * Lightweight cookie-based session using HMAC-SHA256.
 * No external dependencies — uses Node.js built-in `crypto`.
 *
 * Token format: base64url(payload) + '.' + hmac_base64url
 *
 * Usage in Route Handlers:
 *   const session = getSessionFromRequest(req);
 *   if (!session) return new Response('Unauthorized', { status: 401 });
 */

import crypto from 'crypto';

const SECRET      = process.env.SESSION_SECRET ?? 'hackapp-dev-secret-change-in-prod';
const COOKIE_NAME = 'pt_session';
const TTL_MS      = 8 * 60 * 60 * 1000; // 8 hours

// ─── Token helpers ─────────────────────────────────────────────────────────

function sign(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig  = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verify(token) {
  const dot = token.lastIndexOf('.');
  if (dot < 0) return null;

  const data = token.slice(0, dot);
  const sig  = token.slice(dot + 1);

  const expected = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

  // Constant-time comparison (requires equal-length buffers)
  if (sig.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Create a signed session token for a user object.
 * @param {{ id, email, name, role, title }} user
 * @returns {string} signed token
 */
export function createSessionToken(user) {
  return sign({
    id:    user.id,
    email: user.email,
    name:  user.name,
    role:  user.role,
    title: user.title ?? null,
    exp:   Date.now() + TTL_MS,
  });
}

/**
 * Extract and verify the session from an incoming Request object.
 * Use this inside Route Handlers: getSessionFromRequest(req)
 *
 * @param {Request} req
 * @returns {{ id, email, name, role, title, exp } | null}
 */
export function getSessionFromRequest(req) {
  const header = req.headers.get('cookie') ?? '';
  const match  = header.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  try {
    return verify(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

/**
 * Build the Set-Cookie header value for a new session.
 * @param {string} token
 * @returns {string}
 */
export function sessionCookieHeader(token) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(TTL_MS / 1000)}`;
}

/**
 * Build the Set-Cookie header value that clears the session.
 * @returns {string}
 */
export function clearCookieHeader() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`;
}

/**
 * Guard helper — returns the session or throws a 401 Response.
 * Usage: const session = requireSession(req);
 * @param {Request} req
 * @param {string[]} [allowedRoles] - if provided, also check role
 * @returns {{ id, email, name, role, title }}
 * @throws {Response} 401 or 403
 */
export function requireSession(req, allowedRoles = []) {
  const session = getSessionFromRequest(req);
  if (!session) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return session;
}
