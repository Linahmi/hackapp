/**
 * GET /api/requests/mine
 *
 * Returns all requests submitted by the currently logged-in user.
 * Queries the requests + decisions tables directly.
 */

import { getSessionFromRequest } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function GET(req) {
  const session = getSessionFromRequest(req);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await prisma.request.findMany({
    where:   { requester_id: session.id },
    include: { decision: true },
    orderBy: { created_at: 'desc' },
  });

  const items = rows.map(r => {
    const pipeline = r.pipeline_result;
    return {
      request_id:      r.id,
      category:        r.category_l2 ?? r.category_l1 ?? null,
      quantity:        r.quantity,
      budget:          r.budget_amount,
      submitted_at:    r.created_at.toISOString(),
      ai_status:       pipeline?.recommendation?.status ?? null,
      approval_status: r.decision?.status ?? r.status ?? 'PROCESSING',
      decided_by:      r.decision?.approver_id ?? null,
      decided_at:      r.decision?.decided_at?.toISOString() ?? null,
      comment:         r.decision?.notes ?? null,
    };
  });

  return Response.json({ total: items.length, items });
}
