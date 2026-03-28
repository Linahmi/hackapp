/**
 * POST /api/requests/[id]/claim
 *
 * Associates the logged-in requester with a request ID that was just
 * assigned by process-stream. Call this after the SSE 'result' event fires.
 *
 * Body (optional): { draft_id: string }
 *   Pass draft_id if the request was submitted from a saved draft —
 *   this links the draft to the request in both stores.
 *
 * Idempotent: safe to call twice, second call is a no-op.
 */

import { getSessionFromRequest } from '@/lib/session';
import { claimRequest } from '@/lib/requestOwnerStore';
import { linkDraftToRequest } from '@/lib/draftStore';

export async function POST(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: requestId } = await params;

  let draftId = null;
  try {
    const body = await req.json();
    draftId = body?.draft_id ?? null;
  } catch {
    // no body is fine
  }

  const record = claimRequest(
    requestId,
    { id: session.id, email: session.email, name: session.name },
    draftId
  );

  // Cross-link: update the draft with the assigned request ID
  if (draftId) {
    linkDraftToRequest(draftId, requestId);
  }

  return Response.json({ ok: true, record });
}
