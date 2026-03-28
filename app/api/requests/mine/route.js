/**
 * GET /api/requests/mine
 *
 * Returns all requests submitted by the currently logged-in user,
 * enriched with their current approval status and key pipeline metadata.
 *
 * Available to all authenticated users (requester, manager, admin).
 * Managers/admins see their own submitted requests, not others'.
 */

import { getSessionFromRequest } from '@/lib/session';
import { getRequestIdsByOwner } from '@/lib/requestOwnerStore';
import { getApproval } from '@/lib/approvalStore';
import { getPersistedAuditEvents, AUDIT_EVENTS } from '@/lib/auditLogger';
import { getRequestHistory } from '@/lib/requestCounter';

export async function GET(req) {
  const session = getSessionFromRequest(req);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const requestIds = getRequestIdsByOwner(session.id);

  if (requestIds.length === 0) {
    return Response.json({ total: 0, items: [] });
  }

  // Load request history for budget/category/status
  const history = getRequestHistory();
  const historyMap = Object.fromEntries(history.map(r => [r.id, r]));

  const items = requestIds.map(requestId => {
    const hist     = historyMap[requestId] ?? {};
    const decision = getApproval(requestId);

    // Derive approval status
    let approval_status;
    if (decision?.approval_status) {
      approval_status = decision.approval_status;
    } else {
      // Check audit log to see if approval was required or auto-approved
      const events = getPersistedAuditEvents(requestId);
      const autoApproved = events.some(e => e.action === AUDIT_EVENTS.AUTO_APPROVED);
      const approvalRequired = events.some(e => e.action === AUDIT_EVENTS.APPROVAL_REQUIRED);
      approval_status = autoApproved
        ? 'AUTO_APPROVED'
        : approvalRequired
        ? 'PENDING_APPROVAL'
        : 'PROCESSING';
    }

    return {
      request_id:      requestId,
      category:        hist.category ?? null,
      quantity:        hist.quantity ?? null,
      budget:          hist.budget ?? null,
      submitted_at:    hist.timestamp ?? null,
      ai_status:       hist.status ?? null,       // recommended / cannot_proceed
      approval_status,
      decided_by:      decision?.decided_by ?? null,
      decided_at:      decision?.decided_at ?? null,
      comment:         decision?.comment ?? null,
    };
  });

  return Response.json({ total: items.length, items });
}
