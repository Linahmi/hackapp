/**
 * GET /api/approvals
 *
 * Returns pending approval requests for the logged-in manager.
 * Queries the requests + decisions tables directly — no audit log scan.
 *
 * Scoping:
 *   admin   → all PENDING_APPROVAL requests
 *   manager → only requests where pipeline_result.recommendation.required_approver
 *             matches their title (from APPROVER_EMAIL_MAP)
 */

import { getSessionFromRequest } from '@/lib/session';
import { getApproverTitleByEmail } from '@/lib/users';
import { prisma } from '@/lib/prisma';

export async function GET(req) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!['manager', 'admin'].includes(session.role)) {
    return Response.json({ error: 'Forbidden — manager or admin role required' }, { status: 403 });
  }

  const myApproverTitle = session.role === 'admin'
    ? null
    : getApproverTitleByEmail(session.email);

  // Single indexed query: pending requests scoped to this manager's queue
  const rows = await prisma.request.findMany({
    where: {
      status: 'PENDING_APPROVAL',
      OR: [{ decision: null }, { decision: { status: 'PENDING_APPROVAL' } }],
      ...(myApproverTitle ? { required_approver: myApproverTitle } : {}),
    },
    include: { decision: true },
    orderBy: { created_at: 'asc' },
  });

  const items = rows.map(r => {
    const pipeline = r.pipeline_result;
    return {
      request_id:        r.id,
      approval_status:   r.decision?.status ?? 'PENDING_APPROVAL',
      required_approver: r.required_approver ?? null,
      submitted_at:      r.created_at.toISOString(),
      confidence:        pipeline?.confidence_score ?? null,
      escalation_count:  pipeline?.escalations?.length ?? null,
      category:          r.category_l2 ?? r.category_l1 ?? null,
      quantity:          r.quantity,
      budget:            r.budget_amount,
      currency:          r.currency,
      case_type:         pipeline?.case_type ?? null,
      decision_status:   pipeline?.recommendation?.status ?? null,
      top_supplier:      pipeline?.supplier_shortlist?.[0]?.supplier_name ?? null,
      requester:         r.requester_id ?? 'Unknown Requester',
      escalation_reason: pipeline?.escalations?.[0]?.trigger ?? null,
    };
  });

  return Response.json({
    approver:      session.name,
    approver_role: session.title ?? session.role,
    total:         items.length,
    items,
  });
}
