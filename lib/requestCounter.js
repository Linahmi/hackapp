/**
 * requestCounter.js
 *
 * Request ID generation and history — backed by PostgreSQL via Prisma.
 */

export async function getNextRequestId() {
  try {
    const { prisma } = await import('@/lib/prisma');
    const count = await prisma.request.count();
    return `R-${String(count + 1).padStart(4, '0')}`;
  } catch {
    // Fallback: timestamp-based ID if DB is unavailable
    return `R-${Date.now().toString(36).slice(-4).toUpperCase()}`;
  }
}

// No-op: process-stream already saves the request to DB directly.
export async function logRequest(_requestId, _summary) {}

export async function getRequestHistory() {
  try {
    const { prisma } = await import('@/lib/prisma');
    const requests = await prisma.request.findMany({
      select: {
        id:            true,
        pipeline_result: true,
        category_l1:   true,
        category_l2:   true,
        quantity:      true,
        budget_amount: true,
        created_at:    true,
      },
      orderBy: { created_at: 'desc' },
      take:    500,
    });
    return requests.map(r => {
      const result = r.pipeline_result;
      return {
        id:        r.id,
        status:    result?.recommendation?.status ?? null,
        category:  r.category_l2 ? `${r.category_l1} > ${r.category_l2}` : r.category_l1,
        quantity:  r.quantity,
        budget:    r.budget_amount,
        timestamp: r.created_at?.toISOString(),
      };
    });
  } catch {
    return [];
  }
}
