/**
 * GET /api/requests/[id]/status
 *
 * Returns the current status of a request + a chronological event timeline.
 * Designed for polling — the client calls this every few seconds after submitting
 * to detect approve/reject decisions without needing websockets.
 *
 * Access:
 *   - requester: must own the request (via requestOwnerStore)
 *   - manager / admin: unrestricted
 *
 * Response:
 *   {
 *     request_id:      string,
 *     ai_status:       'recommended' | 'cannot_proceed' | 'partial_match' | null,
 *     approval_status: 'PROCESSING' | 'AUTO_APPROVED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED',
 *     is_final:        boolean,   // true when no further changes expected
 *     decided_by:      string | null,
 *     decided_at:      string | null,
 *     comment:         string | null,
 *     required_approver: string | null,
 *     timeline:        AuditEvent[],
 *   }
 *
 * Polling recipe (client-side):
 *   const poll = setInterval(async () => {
 *     const res = await fetch(`/api/requests/${id}/status`, { credentials: 'include' });
 *     const data = await res.json();
 *     if (data.is_final) clearInterval(poll);
 *     updateUI(data);
 *   }, 3000);
 */

import { getSessionFromRequest } from '@/lib/session';
import { getOwner, isOwner } from '@/lib/requestOwnerStore';
import { getApproval } from '@/lib/approvalStore';
import { getPersistedAuditEvents, AUDIT_EVENTS } from '@/lib/auditLogger';
import { getRequestHistory } from '@/lib/requestCounter';

export async function GET(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: requestId } = await params;

  // Access control: requester must own the request
  if (session.role === 'requester' && !(await isOwner(requestId, session.id))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Gather data ───────────────────────────────────────────────────────────

  const decision    = await getApproval(requestId);
  const auditEvents = await getPersistedAuditEvents(requestId);

  // AI pipeline status from request history
  const history    = await getRequestHistory();
  const histRecord = history.find(r => r.id === requestId);

  // Determine approval status
  let approval_status;
  let is_final = false;

  if (decision?.approval_status === 'APPROVED') {
    approval_status = 'APPROVED';
    is_final = true;
  } else if (decision?.approval_status === 'REJECTED') {
    approval_status = 'REJECTED';
    is_final = true;
  } else {
    const autoApproved     = auditEvents.some(e => e.action === AUDIT_EVENTS.AUTO_APPROVED);
    const approvalRequired = auditEvents.some(e => e.action === AUDIT_EVENTS.APPROVAL_REQUIRED);
    const received         = auditEvents.some(e => e.action === AUDIT_EVENTS.REQUEST_RECEIVED);

    if (autoApproved) {
      approval_status = 'AUTO_APPROVED';
      is_final = true;
    } else if (approvalRequired) {
      approval_status = 'PENDING_APPROVAL';
    } else if (received) {
      approval_status = 'PROCESSING';
    } else {
      approval_status = 'UNKNOWN';
    }
  }

  // Required approver from audit
  const approvalReqEvent = auditEvents.find(e => e.action === AUDIT_EVENTS.APPROVAL_REQUIRED);
  const requiredApprover = approvalReqEvent?.metadata?.required_approver ?? null;

  // Build clean timeline (no internal metadata noise)
  const LABEL = {
    [AUDIT_EVENTS.REQUEST_RECEIVED]:         'Request received',
    [AUDIT_EVENTS.REQUEST_PARSED]:           'Request parsed by AI',
    [AUDIT_EVENTS.SUPPLIERS_SCORED]:         'Suppliers scored',
    [AUDIT_EVENTS.NO_SUPPLIER_FOUND]:        'No eligible supplier found',
    [AUDIT_EVENTS.DECISION_GENERATED]:       'AI decision generated',
    [AUDIT_EVENTS.AUTO_APPROVED]:            'Auto-approved (below threshold)',
    [AUDIT_EVENTS.APPROVAL_REQUIRED]:        'Sent for approval',
    [AUDIT_EVENTS.ESCALATION_RAISED]:        'Escalation raised',
    [AUDIT_EVENTS.NOTIFICATION_SENT]:        'Notification sent',
    [AUDIT_EVENTS.REMINDER_SCHEDULED]:       'Reminder scheduled',
    [AUDIT_EVENTS.REMINDER_SENT]:            'Reminder sent',
    [AUDIT_EVENTS.REMINDER_CANCELLED]:       'Reminder cancelled',
    [AUDIT_EVENTS.REQUEST_APPROVED]:         'Request approved',
    [AUDIT_EVENTS.REQUEST_REJECTED]:         'Request rejected',
  };

  const timeline = auditEvents
    .filter(e => LABEL[e.action])
    .map(e => ({
      event:     e.action,
      label:     LABEL[e.action],
      timestamp: e.timestamp,
      actor:     e.user_id !== 'system' ? e.user_id : null,
    }));

  return Response.json({
    request_id:        requestId,
    ai_status:         histRecord?.status ?? null,
    approval_status,
    is_final,
    required_approver: requiredApprover,
    decided_by:        decision?.decided_by ?? null,
    decided_at:        decision?.decided_at ?? null,
    comment:           decision?.comment ?? null,
    timeline,
    // Polling hint: stop polling when is_final === true
    poll_again:        !is_final,
  });
}
