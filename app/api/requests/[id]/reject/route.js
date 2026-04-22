/**
 * POST /api/requests/[id]/reject
 *
 * Allowed roles: manager, admin
 * Body (optional): { comment: string }
 */

import { getSessionFromRequest } from '@/lib/session';
import { cancelReminder } from '@/lib/reminderService';
import { logAuditEvent, AUDIT_EVENTS, getPersistedAuditEvents } from '@/lib/auditLogger';
import { setDecision, isDecided } from '@/lib/approvalStore';
import { sendDecisionEmail } from '@/lib/notificationService';

export async function POST(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!['manager', 'admin'].includes(session.role)) {
    return Response.json({ error: 'Forbidden — manager or admin role required' }, { status: 403 });
  }

  const { id: requestId } = await params;

  if (await isDecided(requestId)) {
    return Response.json({ error: 'Request already decided' }, { status: 409 });
  }

  let comment = null;
  try {
    const body = await req.json();
    comment = body?.comment ?? null;
  } catch {
    // no body is fine
  }

  const auditEvents      = await getPersistedAuditEvents(requestId);
  const approvalReqEvent = auditEvents.find(e => e.action === AUDIT_EVENTS.APPROVAL_REQUIRED);
  const requiredApprover = approvalReqEvent?.metadata?.required_approver ?? null;

  const parsedEvent = auditEvents.find(e => e.action === AUDIT_EVENTS.REQUEST_PARSED);
  const summary = parsedEvent
    ? [parsedEvent.metadata?.quantity, '×', parsedEvent.metadata?.category, '·', parsedEvent.metadata?.currency, parsedEvent.metadata?.budget].filter(Boolean).join(' ')
    : requestId;

  cancelReminder(requestId);

  logAuditEvent({
    action:   AUDIT_EVENTS.REQUEST_REJECTED,
    requestId,
    userId:   session.id,
    metadata: {
      rejected_by:       session.email,
      rejector_name:     session.name,
      required_approver: requiredApprover,
      comment,
    },
  });

  const record = await setDecision(requestId, {
    status:  'REJECTED',
    userId:  session.id,
    comment,
  });

  const requesterEmail = 'requester@company.com';
  await sendDecisionEmail({
    to:            requesterEmail,
    requestId,
    summary,
    status:        'cannot_proceed',
    aiDecision:    `Request ${requestId} has been rejected by ${session.name}.`,
    justification: comment ?? `Rejected by ${session.name} (${session.title ?? session.role}).`,
  });

  return Response.json({
    ok:         true,
    requestId,
    status:     'REJECTED',
    rejectedBy: session.email,
    record,
  });
}
