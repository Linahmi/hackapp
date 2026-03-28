/**
 * GET /api/approvals
 *
 * Returns pending approval requests for the currently logged-in manager.
 *
 * Scoping logic:
 *   - admin → sees all PENDING_APPROVAL requests
 *   - manager → sees only requests where requiredApprover matches their title
 *     (cross-referenced via APPROVER_EMAIL_MAP in lib/users.js)
 *
 * Data source:
 *   Uses the persisted audit log (data/audit_log.json) to find all requests
 *   that reached APPROVAL_REQUIRED status, then filters out those already decided
 *   in the approvalStore (data/approvals.json).
 */

import { getSessionFromRequest } from '@/lib/session';
import { getPersistedAuditEvents, AUDIT_EVENTS } from '@/lib/auditLogger';
import { getApproval } from '@/lib/approvalStore';
import { getApproverTitleByEmail } from '@/lib/users';

export async function GET(req) {
  // ── Auth ──────────────────────────────────────────────────────────────
  const session = getSessionFromRequest(req);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!['manager', 'admin'].includes(session.role)) {
    return Response.json({ error: 'Forbidden — manager or admin role required' }, { status: 403 });
  }

  // ── Find approver title for this manager ──────────────────────────────
  // admin sees everything; managers see their own queue
  const myApproverTitle = session.role === 'admin'
    ? null
    : getApproverTitleByEmail(session.email);

  // ── Scan audit log for APPROVAL_REQUIRED events ───────────────────────
  const allEvents = getPersistedAuditEvents(null); // all events from file
  const approvalRequiredEvents = allEvents.filter(
    e => e.action === AUDIT_EVENTS.APPROVAL_REQUIRED
  );

  // Deduplicate by request_id (keep latest event per request)
  const byRequest = new Map();
  for (const event of approvalRequiredEvents) {
    byRequest.set(event.request_id, event);
  }

  // ── Build pending list ─────────────────────────────────────────────────
  const pending = [];

  for (const [requestId, event] of byRequest.entries()) {
    // Skip if already decided
    const decision = getApproval(requestId);
    if (decision && decision.approval_status !== 'PENDING_APPROVAL') continue;

    const requiredApprover = event.metadata?.required_approver ?? null;

    // Scope to this manager's queue
    if (myApproverTitle !== null && requiredApprover !== myApproverTitle) continue;

    // Enrich with parsed request details from audit trail
    const requestEvents = allEvents.filter(e => e.request_id === requestId);
    const parsedEvent   = requestEvents.find(e => e.action === AUDIT_EVENTS.REQUEST_PARSED);
    const decisionEvent = requestEvents.find(e => e.action === AUDIT_EVENTS.DECISION_GENERATED);

    pending.push({
      request_id:        requestId,
      approval_status:   decision?.approval_status ?? 'PENDING_APPROVAL',
      required_approver: requiredApprover,
      submitted_at:      event.timestamp,
      confidence:        event.metadata?.confidence ?? null,
      escalation_count:  event.metadata?.escalation_count ?? null,
      // From REQUEST_PARSED event
      category:          parsedEvent?.metadata?.category ?? null,
      quantity:          parsedEvent?.metadata?.quantity ?? null,
      budget:            parsedEvent?.metadata?.budget ?? null,
      currency:          parsedEvent?.metadata?.currency ?? null,
      // From DECISION_GENERATED event
      case_type:         decisionEvent?.metadata?.case_type ?? null,
      decision_status:   decisionEvent?.metadata?.decision_status ?? null,
      top_supplier:      decisionEvent?.metadata?.top_supplier ?? null,
    });
  }

  // Sort: oldest first (most urgent)
  pending.sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));

  return Response.json({
    approver:      session.name,
    approver_role: session.title ?? session.role,
    total:         pending.length,
    items:         pending,
  });
}
