/**
 * POST /api/auth/logout
 * Clears the session cookie.
 */

import { clearCookieHeader } from '@/lib/session';

export async function POST() {
  return Response.json(
    { ok: true },
    { headers: { 'Set-Cookie': clearCookieHeader() } }
  );
}
