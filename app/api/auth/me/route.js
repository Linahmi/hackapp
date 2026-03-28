/**
 * GET /api/auth/me
 * Returns the currently authenticated user, or 401 if not logged in.
 */

import { getSessionFromRequest } from '@/lib/session';

export async function GET(req) {
  const session = getSessionFromRequest(req);

  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return Response.json({
    id:    session.id,
    email: session.email,
    name:  session.name,
    role:  session.role,
    title: session.title,
  });
}
