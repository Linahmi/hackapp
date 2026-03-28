/**
 * GET /api/db/requests?userId=xxx
 */
import { getRequestIdsByOwner } from '@/lib/requestOwnerStore';
import { getApproval } from '@/lib/approvalStore';
import { getPersistedAuditEvents, AUDIT_EVENTS } from '@/lib/auditLogger';
import { getRequestHistory } from '@/lib/requestCounter';
import { NextResponse } from 'next/server';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const requestIds = getRequestIdsByOwner(userId);
  if (requestIds.length === 0) {
    return NextResponse.json({ total: 0, items: [] });
  }

  const history = getRequestHistory();
  const historyMap = Object.fromEntries(history.map(r => [r.id, r]));

  const items = requestIds.map(requestId => {
    const hist = historyMap[requestId] ?? {};
    const decision = getApproval(requestId);

    let approval_status;
    if (decision?.approval_status) {
      approval_status = decision.approval_status;
    } else {
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
      request_id: requestId,
      category: hist.category ?? null,
      quantity: hist.quantity ?? null,
      budget: hist.budget ?? null,
      submitted_at: hist.timestamp ?? null,
      ai_status: hist.status ?? null,
      approval_status,
      decided_by: decision?.decided_by ?? null,
      decided_at: decision?.decided_at ?? null,
      comment: decision?.comment ?? null,
    };
  });

  return NextResponse.json({ total: items.length, items });
}
