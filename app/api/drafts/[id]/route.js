/**
 * GET    /api/drafts/[id]  → get one draft
 * PUT    /api/drafts/[id]  → update text / title
 * DELETE /api/drafts/[id]  → delete (only if not yet submitted)
 */

import { getSessionFromRequest } from '@/lib/session';
import { getDraft, updateDraft, deleteDraft } from '@/lib/draftStore';

export async function GET(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const draft = getDraft(id);
  if (!draft) return Response.json({ error: 'Draft not found' }, { status: 404 });
  if (draft.requester_id !== session.id && session.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  return Response.json(draft);
}

export async function PUT(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const draft = getDraft(id);
  if (!draft) return Response.json({ error: 'Draft not found' }, { status: 404 });
  if (draft.requester_id !== session.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const updated = updateDraft(id, { text: body?.text, title: body?.title });
  if (!updated) {
    return Response.json({ error: 'Cannot update a submitted draft' }, { status: 409 });
  }

  return Response.json(updated);
}

export async function DELETE(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const ok = deleteDraft(id, session.id);
  if (!ok) {
    return Response.json(
      { error: 'Draft not found, not yours, or already submitted' },
      { status: 404 }
    );
  }

  return Response.json({ ok: true, deleted: id });
}
