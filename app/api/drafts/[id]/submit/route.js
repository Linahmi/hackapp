/**
 * POST /api/drafts/[id]/submit
 *
 * Marks a draft as submitted and returns its text.
 * The client uses the returned text to call POST /api/process-stream,
 * then calls POST /api/requests/[reqId]/claim to link ownership.
 *
 * Response:
 *   { text: string, draft_id: string }
 *
 * The actual pipeline call (process-stream) stays in the client —
 * this endpoint only handles the draft lifecycle transition.
 */

import { getSessionFromRequest } from '@/lib/session';
import { submitDraft } from '@/lib/draftStore';

export async function POST(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const result = submitDraft(id, session.id);

  if (!result) {
    return Response.json(
      { error: 'Draft not found, not yours, or already submitted' },
      { status: 404 }
    );
  }

  // Return the text so the client can pipe it straight into process-stream
  return Response.json({
    draft_id: result.draft.id,
    text:     result.text,
    hint:     'POST this text to /api/process-stream, then claim the returned request_id via POST /api/requests/{id}/claim',
  });
}
