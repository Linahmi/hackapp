/**
 * POST /api/requests/[id]/approve
 *
 * Allowed roles: manager, admin
 * Body (optional): { comment: string }
 */

import { getSessionFromRequest } from '@/lib/session';
import { cancelReminder } from '@/lib/reminderService';
import { logAuditEvent, AUDIT_EVENTS, getPersistedAuditEvents } from '@/lib/auditLogger';
import { setDecision, isDecided } from '@/lib/approvalStore';
import { sendDecisionEmail } from '@/lib/notificationService';
import { prisma } from '@/lib/prisma';

export async function POST(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!['manager', 'admin'].includes(session.role)) {
    return Response.json({ error: 'Forbidden — manager or admin role required' }, { status: 403 });
  }

  const { id: requestId } = await params;

  const requestRecord = await prisma.request.findUnique({
    where: { id: requestId },
    select: { required_approver: true },
  });
  if (!requestRecord) {
    return Response.json({ error: 'Request not found' }, { status: 404 });
  }
  if (session.role === 'manager' && requestRecord.required_approver && requestRecord.required_approver !== session.title) {
    return Response.json({ error: 'Forbidden — this request is not in your approval queue' }, { status: 403 });
  }

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
    action:   AUDIT_EVENTS.REQUEST_APPROVED,
    requestId,
    userId:   session.id,
    metadata: {
      approved_by:       session.email,
      approver_name:     session.name,
      required_approver: requiredApprover,
      comment,
    },
  });

  const record = await setDecision(requestId, {
    status:  'APPROVED',
    userId:  session.id,
    comment,
  });

  const requesterEmail = 'requester@company.com';
  await sendDecisionEmail({
    to:            requesterEmail,
    requestId,
    summary,
    status:        'recommended',
    aiDecision:    `Request ${requestId} has been approved by ${session.name}.`,
    justification: comment ?? `Approved by ${session.name} (${session.title ?? session.role}).`,
  });

  return Response.json({
    ok:         true,
    requestId,
    status:     'APPROVED',
    approvedBy: session.email,
    record,
  });
}
