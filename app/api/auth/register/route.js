/**
 * POST /api/auth/register
 *
 * Body: { name, email, password, role? }
 * - role defaults to 'requester'
 * - only 'admin' can create manager/admin accounts (checked via session)
 *
 * On success: sets session cookie + returns user object (auto-login).
 */

import { findUserByEmail } from '@/lib/users';
import { createUser } from '@/lib/userStore';
import { createSessionToken, sessionCookieHeader, getSessionFromRequest } from '@/lib/session';

const ALLOWED_ROLES = ['requester', 'manager', 'admin'];

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, email, password, role = 'requester' } = body ?? {};

  // ── Validate fields ────────────────────────────────────────────────────
  if (!name?.trim())     return Response.json({ error: 'Name is required' }, { status: 400 });
  if (!email?.trim())    return Response.json({ error: 'Email is required' }, { status: 400 });
  if (!password?.trim()) return Response.json({ error: 'Password is required' }, { status: 400 });
  if (password.length < 6) return Response.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  if (!ALLOWED_ROLES.includes(role)) return Response.json({ error: 'Invalid role' }, { status: 400 });

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Invalid email address' }, { status: 400 });
  }

  // ── Role guard: only admins can create manager/admin accounts ──────────
  if (role !== 'requester') {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== 'admin') {
      return Response.json(
        { error: 'Only admins can create manager or admin accounts' },
        { status: 403 }
      );
    }
  }

  // ── Check email uniqueness ─────────────────────────────────────────────
  const existing = findUserByEmail(email);
  if (existing) {
    return Response.json({ error: 'An account with this email already exists' }, { status: 409 });
  }

  // ── Create user ────────────────────────────────────────────────────────
  const user = createUser({ name: name.trim(), email: email.trim(), password, role });

  // Auto-login: set session cookie immediately
  const token = createSessionToken({ ...user, password: undefined });

  return Response.json(
    { user },
    {
      status: 201,
      headers: { 'Set-Cookie': sessionCookieHeader(token) },
    }
  );
}
