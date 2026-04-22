/**
 * approvalStore.js
 *
 * Persists approval decisions to PostgreSQL via Prisma.
 * All functions are async.
 */

function mapDecision(d) {
  if (!d) return null;
  return {
    request_id:        d.request_id,
    approval_status:   d.status,
    decided_by:        d.approver_id ?? null,
    decided_at:        d.decided_at?.toISOString() ?? null,
    comment:           d.notes ?? null,
    required_approver: null,
    summary:           null,
    requester_id:      null,
    created_at:        d.decided_at?.toISOString() ?? null,
  };
}

export async function setDecision(requestId, { status, userId, comment = null }) {
  const { prisma } = await import('@/lib/prisma');
  const d = await prisma.decision.upsert({
    where:  { request_id: requestId },
    update: { status, approver_id: userId, notes: comment, decided_at: new Date() },
    create: { request_id: requestId, status, approver_id: userId, notes: comment, decided_at: new Date() },
  });
  return mapDecision(d);
}

export async function getApproval(requestId) {
  try {
    const { prisma } = await import('@/lib/prisma');
    const d = await prisma.decision.findUnique({ where: { request_id: requestId } });
    return mapDecision(d);
  } catch {
    return null;
  }
}

export async function isDecided(requestId) {
  try {
    const { prisma } = await import('@/lib/prisma');
    const d = await prisma.decision.findUnique({
      where:  { request_id: requestId },
      select: { status: true },
    });
    return d !== null && d.status !== 'PENDING_APPROVAL';
  } catch {
    return false;
  }
}

export async function listPendingApprovals() {
  try {
    const { prisma } = await import('@/lib/prisma');
    const rows = await prisma.decision.findMany({ where: { status: 'PENDING_APPROVAL' } });
    return rows.map(mapDecision);
  } catch {
    return [];
  }
}

export async function listAllApprovals() {
  try {
    const { prisma } = await import('@/lib/prisma');
    const rows = await prisma.decision.findMany({ orderBy: { decided_at: 'desc' } });
    return rows.map(mapDecision);
  } catch {
    return [];
  }
}
