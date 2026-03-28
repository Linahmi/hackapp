/**
 * GET  /api/drafts     → list my drafts (requester)
 * POST /api/drafts     → create a new draft
 */

import { getSessionFromRequest } from '@/lib/session';
import { createDraft, listDraftsByRequester } from '@/lib/draftStore';

export async function GET(req) {
  const session = getSessionFromRequest(req);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const drafts = listDraftsByRequester(session.id);
  return Response.json({ total: drafts.length, items: drafts });
}

export async function POST(req) {
  const session = getSessionFromRequest(req);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { text, title } = body ?? {};
  if (!text?.trim()) {
    return Response.json({ error: 'text is required' }, { status: 400 });
  }

  const draft = createDraft({ requesterId: session.id, text: text.trim(), title });
  return Response.json(draft, { status: 201 });
}
