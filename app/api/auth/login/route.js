/**
 * POST /api/auth/login
 *
 * Body: { email: string, password: string }
 * Response: { user: { id, email, name, role, title } }
 * Sets a signed session cookie on success.
 */

import { findUserByEmail } from '@/lib/users';
import { createSessionToken, sessionCookieHeader } from '@/lib/session';

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { email, password } = body ?? {};

  if (!email || !password) {
    return Response.json({ error: 'email and password are required' }, { status: 400 });
  }

  const user = findUserByEmail(email);

  // Plain-text comparison — acceptable for hackathon only
  if (!user || user.password !== password) {
    return Response.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = createSessionToken(user);

  return Response.json(
    { user: { id: user.id, email: user.email, name: user.name, role: user.role, title: user.title } },
    { headers: { 'Set-Cookie': sessionCookieHeader(token) } }
  );
}
