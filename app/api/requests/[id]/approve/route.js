/**
 * POST /api/requests/[id]/approve
 *
 * Allowed roles: manager, admin
 *
 * Body (optional): { comment: string }
 *
 * Actions:
 *   1. Verify session (manager or admin)
 *   2. Check request isn't already decided
 *   3. cancelReminder(requestId)
 *   4. logAuditEvent(REQUEST_APPROVED)
 *   5. Persist decision to approvalStore
 *   6. Send decision email to requester
 */

import { getSessionFromRequest } from '@/lib/session';
import { cancelReminder } from '@/lib/reminderService';
import { logAuditEvent, AUDIT_EVENTS, getPersistedAuditEvents } from '@/lib/auditLogger';
import { setDecision, isDecided } from '@/lib/approvalStore';
import { sendDecisionEmail } from '@/lib/notificationService';
import { getApproverEmail } from '@/lib/users';

export async function POST(req, { params }) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const session = getSessionFromRequest(req);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!['manager', 'admin'].includes(session.role)) {
    return Response.json({ error: 'Forbidden — manager or admin role required' }, { status: 403 });
  }

  const { id: requestId } = await params;

  // ── Guard: already decided ───────────────────────────────────────────────
  if (isDecided(requestId)) {
    return Response.json({ error: 'Request already decided' }, { status: 409 });
  }

  // ── Optional comment ────────────────────────────────────────────────────
  let comment = null;
  try {
    const body = await req.json();
    comment = body?.comment ?? null;
  } catch {
    // no body is fine
  }

  // ── Pull context from audit trail ────────────────────────────────────────
  const auditEvents = getPersistedAuditEvents(requestId);
  const approvalReqEvent = auditEvents.find(e => e.action === AUDIT_EVENTS.APPROVAL_REQUIRED);
  const requiredApprover = approvalReqEvent?.metadata?.required_approver ?? null;

  const parsedEvent = auditEvents.find(e => e.action === AUDIT_EVENTS.REQUEST_PARSED);
  const summary = parsedEvent
    ? [parsedEvent.metadata?.quantity, '×', parsedEvent.metadata?.category, '·', parsedEvent.metadata?.currency, parsedEvent.metadata?.budget].filter(Boolean).join(' ')
    : requestId;

  // ── Core actions ─────────────────────────────────────────────────────────

  // 1. Cancel the pending reminder so the approver stops receiving emails
  cancelReminder(requestId);

  // 2. Log the approval event with the real userId
  logAuditEvent({
    action:    AUDIT_EVENTS.REQUEST_APPROVED,
    requestId,
    userId:    session.id,
    metadata:  {
      approved_by:       session.email,
      approver_name:     session.name,
      required_approver: requiredApprover,
      comment,
    },
  });

  // 3. Persist decision (JSON file)
  const record = setDecision(requestId, {
    status:          'APPROVED',
    userId:          session.id,
    comment,
    requiredApprover,
    summary,
  });

  // 3b. Persist decision (PostgreSQL — non-blocking)
  try {
    const { prisma } = await import('@/lib/prisma');
    await prisma.decision.upsert({
      where:  { request_id: requestId },
      update: { status: 'APPROVED', approver_id: session.id, notes: comment, decided_at: new Date() },
      create: { request_id: requestId, status: 'APPROVED', approver_id: session.id, notes: comment, decided_at: new Date() },
    });
  } catch (e) {
    console.warn('[DB] Failed to persist APPROVED decision:', e.message);
  }

  // 4. Notify requester (placeholder email until requester auth is wired)
  const requesterEmail = 'requester@company.com';
  await sendDecisionEmail({
    to:          requesterEmail,
    requestId,
    summary,
    status:      'recommended',
    aiDecision:  `Request ${requestId} has been approved by ${session.name}.`,
    justification: comment ?? `Approved by ${session.name} (${session.title ?? session.role}).`,
  });

  return Response.json({
    ok:        true,
    requestId,
    status:    'APPROVED',
    approvedBy: session.email,
    record,
  });
}
